import { prisma } from "@/lib/prisma";
import { generateStorageKey, cleanupChunks, deleteStoredFile } from "@/lib/storage";

export class QuotaExceededError extends Error {
  constructor(public readonly quotaBytes: bigint, public readonly usedBytes: bigint) {
    super("Storage quota exceeded.");
    this.name = "QuotaExceededError";
  }
}

type Owner = { userId: string } | { anonymousSessionId: string };

// The DB is remote with real network latency (not localhost), so Prisma's
// default ~5s interactive-transaction timeout is tight under concurrency —
// give quota reservation more headroom explicitly rather than tuning it
// globally for every transaction in the app.
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

/**
 * Reserves `declaredSize` bytes against the owner's quota and creates a
 * RESERVED File row, all inside one row-locked transaction — this is what
 * closes the race window where two concurrent uploads could both pass a
 * naive "read usedBytes, check, then write" check.
 */
export async function reserveQuota(
  owner: Owner,
  declaredSize: bigint,
  meta: { originalName: string; mimeType: string; folderId: string | null }
) {
  const storageKey = generateStorageKey();

  return prisma.$transaction(async (tx) => {
    if ("userId" in owner) {
      const rows = await tx.$queryRaw<{ usedBytes: bigint; quotaBytes: bigint | null }[]>`
        SELECT usedBytes, quotaBytes FROM User WHERE id = ${owner.userId} FOR UPDATE
      `;
      const row = rows[0];
      if (!row) throw new Error("User not found.");
      // quotaBytes = null means unlimited — a superuser, granted manually.
      if (row.quotaBytes !== null && row.usedBytes + declaredSize > row.quotaBytes) {
        throw new QuotaExceededError(row.quotaBytes, row.usedBytes);
      }
      await tx.user.update({
        where: { id: owner.userId },
        data: { usedBytes: { increment: declaredSize } },
      });
    } else {
      const rows = await tx.$queryRaw<{ usedBytes: bigint; quotaBytes: bigint }[]>`
        SELECT usedBytes, quotaBytes FROM AnonymousSession WHERE id = ${owner.anonymousSessionId} FOR UPDATE
      `;
      const row = rows[0];
      if (!row) throw new Error("Anonymous session not found.");
      if (row.usedBytes + declaredSize > row.quotaBytes) {
        throw new QuotaExceededError(row.quotaBytes, row.usedBytes);
      }
      await tx.anonymousSession.update({
        where: { id: owner.anonymousSessionId },
        data: { usedBytes: { increment: declaredSize } },
      });
    }

    const file = await tx.file.create({
      data: {
        storageKey,
        originalName: meta.originalName,
        mimeType: meta.mimeType,
        size: declaredSize,
        status: "RESERVED",
        folderId: meta.folderId,
        ...("userId" in owner ? { userId: owner.userId } : { anonymousSessionId: owner.anonymousSessionId }),
      },
    });

    return file;
  }, TX_OPTIONS);
}

/**
 * Reconciles the reservation against the real byte count written to disk
 * and flips the File row to COMMITTED. Called after the stream finishes.
 */
export async function commitQuota(fileId: string, actualSize: bigint, checksumSha256?: string) {
  return prisma.$transaction(async (tx) => {
    const file = await tx.file.findUniqueOrThrow({ where: { id: fileId } });
    const delta = actualSize - file.size;

    if (file.userId) {
      await tx.user.update({
        where: { id: file.userId },
        data: { usedBytes: { increment: delta } },
      });
    } else if (file.anonymousSessionId) {
      await tx.anonymousSession.update({
        where: { id: file.anonymousSessionId },
        data: { usedBytes: { increment: delta } },
      });
    }

    return tx.file.update({
      where: { id: fileId },
      data: { size: actualSize, status: "COMMITTED", checksumSha256 },
    });
  }, TX_OPTIONS);
}

/**
 * Rolls back a failed/aborted upload: releases the reserved bytes and
 * deletes the RESERVED File row. Disk cleanup is the caller's responsibility
 * (this only touches the DB side of the reservation).
 */
export async function releaseQuota(fileId: string) {
  return prisma.$transaction(async (tx) => {
    const file = await tx.file.findUnique({ where: { id: fileId } });
    if (!file) return;

    if (file.userId) {
      await tx.user.update({
        where: { id: file.userId },
        data: { usedBytes: { decrement: file.size } },
      });
    } else if (file.anonymousSessionId) {
      await tx.anonymousSession.update({
        where: { id: file.anonymousSessionId },
        data: { usedBytes: { decrement: file.size } },
      });
    }

    await tx.file.delete({ where: { id: fileId } });
  }, TX_OPTIONS);
}

/**
 * Self-heals RESERVED rows that never got committed or released — e.g. the
 * server process crashed mid-upload and the normal rollback path never ran.
 * Safe to call opportunistically (e.g. on dashboard load) or from a cron job.
 */
export async function reconcileStaleReservations(olderThanMinutes = 30) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const stale = await prisma.file.findMany({
    where: { status: "RESERVED", createdAt: { lt: cutoff } },
  });

  for (const file of stale) {
    // Best-effort cleanup of both possible leftovers: a partially-written
    // single-shot file, or an abandoned chunked upload's temp chunk dir.
    // Harmless no-op for whichever one doesn't apply.
    await deleteStoredFile(file.storageKey).catch(() => {});
    await cleanupChunks(file.id).catch(() => {});
    await releaseQuota(file.id).catch(() => {
      // best-effort — a concurrent commit/release may have already cleared it
    });
  }

  return stale.length;
}
