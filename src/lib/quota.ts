import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { generateStorageKey, cleanupChunks, deleteStoredFile } from "@/lib/storage";
import { kickoffScanForFile } from "@/lib/virus-scan";
import { type Identity, ownerWhere } from "@/lib/identity";

export class QuotaExceededError extends Error {
  constructor(public readonly quotaBytes: bigint, public readonly usedBytes: bigint) {
    super("Storage quota exceeded.");
    this.name = "QuotaExceededError";
  }
}

export type Owner = Identity;

export async function adjustOwnerUsedBytes(
  tx: Prisma.TransactionClient,
  owner: { userId?: string | null; anonymousSessionId?: string | null } | Identity,
  delta: bigint
) {
  if (delta === BigInt(0)) return;

  if ("userId" in owner && owner.userId) {
    await tx.user.update({
      where: { id: owner.userId },
      data: { usedBytes: { increment: delta } },
    });
  } else if ("anonymousSessionId" in owner && owner.anonymousSessionId) {
    await tx.anonymousSession.update({
      where: { id: owner.anonymousSessionId },
      data: { usedBytes: { increment: delta } },
    });
  }
}

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
        ...ownerWhere(owner),
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
    await adjustOwnerUsedBytes(tx, file, delta);

    return tx.file.update({
      where: { id: fileId },
      data: { size: actualSize, status: "COMMITTED", checksumSha256 },
    });
  }, TX_OPTIONS).then((committed) => {
    // Fires after the transaction has fully committed — a network call to
    // VirusTotal has no business holding a DB transaction open. Never
    // awaited by the caller: the upload response shouldn't wait on it, and
    // kickoffScanForFile never throws (it catches internally).
    void kickoffScanForFile(committed);
    return committed;
  });
}

/**
 * Reserves the size *delta* for replacing an already-committed file's
 * content in place (real in-browser editing — Word/Excel/PDF editors),
 * as opposed to reserveQuota's create-a-new-file path. Row-locks the file
 * and its owner, verifies ownership/editability, and — since this can only
 * ever be reached by a request already holding a session — a server-side
 * INFECTED check here is defense in depth, not just a UI convenience (the
 * menu item that opens an editor is already hidden for infected files).
 */
export async function reserveReplaceQuota(fileId: string, identity: Owner, declaredSize: bigint) {
  const newStorageKey = generateStorageKey();

  const { file, delta } = await prisma.$transaction(async (tx) => {
    const file = await tx.file.findUniqueOrThrow({ where: { id: fileId } });

    const owns =
      "userId" in identity ? file.userId === identity.userId : file.anonymousSessionId === identity.anonymousSessionId;
    if (!owns) throw new Error("Not found.");
    if (file.status !== "COMMITTED") throw new Error("This file isn't in an editable state.");
    if (file.scanStatus === "INFECTED") throw new Error("This file was flagged as malicious and can't be edited.");

    const delta = declaredSize - file.size;

    if (file.userId) {
      const rows = await tx.$queryRaw<{ usedBytes: bigint; quotaBytes: bigint | null }[]>`
        SELECT usedBytes, quotaBytes FROM User WHERE id = ${file.userId} FOR UPDATE
      `;
      const row = rows[0];
      if (!row) throw new Error("User not found.");
      if (delta > BigInt(0) && row.quotaBytes !== null && row.usedBytes + delta > row.quotaBytes) {
        throw new QuotaExceededError(row.quotaBytes, row.usedBytes);
      }
      await tx.user.update({ where: { id: file.userId }, data: { usedBytes: { increment: delta } } });
    } else if (file.anonymousSessionId) {
      const rows = await tx.$queryRaw<{ usedBytes: bigint; quotaBytes: bigint }[]>`
        SELECT usedBytes, quotaBytes FROM AnonymousSession WHERE id = ${file.anonymousSessionId} FOR UPDATE
      `;
      const row = rows[0];
      if (!row) throw new Error("Anonymous session not found.");
      if (delta > BigInt(0) && row.usedBytes + delta > row.quotaBytes) {
        throw new QuotaExceededError(row.quotaBytes, row.usedBytes);
      }
      await tx.anonymousSession.update({ where: { id: file.anonymousSessionId }, data: { usedBytes: { increment: delta } } });
    }

    return { file, delta };
  }, TX_OPTIONS);

  return { file, newStorageKey, oldStorageKey: file.storageKey, declaredSize, delta };
}

/**
 * Reconciles the replacement against the real byte count written to disk,
 * repoints the File row at the new blob, resets its scan status (new
 * content needs a fresh scan), then — once the transaction has committed —
 * deletes the superseded blob and kicks off that fresh scan. The old blob
 * is deleted, not orphaned: unlike the PURGED-retention system (a safety
 * net for user-initiated deletes), an edit-save's clear intent is "update
 * this content," and storageKey is 1:1 with File.id with no dedup anywhere
 * in the schema, so nothing else could be referencing the old blob.
 */
export async function commitReplaceQuota(
  fileId: string,
  newStorageKey: string,
  oldStorageKey: string,
  declaredSize: bigint,
  actualSize: bigint,
  checksumSha256: string
) {
  const committed = await prisma.$transaction(async (tx) => {
    const file = await tx.file.findUniqueOrThrow({ where: { id: fileId } });
    const reconcileDelta = actualSize - declaredSize;
    await adjustOwnerUsedBytes(tx, file, reconcileDelta);

    return tx.file.update({
      where: { id: fileId },
      data: {
        storageKey: newStorageKey,
        size: actualSize,
        checksumSha256,
        scanStatus: "PENDING",
        scanAnalysisId: null,
        scanCheckedAt: null,
      },
    });
  }, TX_OPTIONS);

  await deleteStoredFile(oldStorageKey).catch(() => {});
  void kickoffScanForFile(committed);

  return committed;
}

/**
 * Rolls back a failed/aborted replace: undoes reserveReplaceQuota's delta
 * reservation without touching the File row itself (it's an existing,
 * still-valid committed file — nothing to delete, unlike releaseQuota's
 * RESERVED-row rollback).
 */
export async function releaseReplaceQuota(fileId: string, delta: bigint) {
  return prisma.$transaction(async (tx) => {
    const file = await tx.file.findUnique({ where: { id: fileId } });
    if (!file) return;

    await adjustOwnerUsedBytes(tx, file, -delta);
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

    await adjustOwnerUsedBytes(tx, file, -file.size);

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
