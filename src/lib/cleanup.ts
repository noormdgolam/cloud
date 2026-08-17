import { prisma } from "./prisma";
import { deleteStoredFile } from "./storage";
import { adjustOwnerUsedBytes } from "./quota";

export type CleanupResult = {
  retentionDays: number;
  filesRemoved: number;
  emptySessionsRemoved: number;
};

// Deletes files (and their disk blobs) from unclaimed anonymous sessions
// older than the retention window, plus long-abandoned empty anonymous
// session rows. Shared by the CLI script and the /api/cron route so the
// two never drift.
export async function cleanupAnonymousFiles(retentionDays = 30): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const staleFiles = await prisma.file.findMany({
    where: {
      anonymousSessionId: { not: null },
      createdAt: { lt: cutoff },
      anonymousSession: { claimedByUserId: null },
      // Only files that were never soft-deleted — a file already in the
      // DELETED/PURGED lifecycle is purgeOldTrash's job, on its own
      // deletedAt-based timer. Without this, a file uploaded >30 days ago
      // but trashed only yesterday gets hard-deleted immediately, defeating
      // the 30-day trash/restore window entirely for anonymous sessions;
      // and once purgeOldTrash and this job both run in the same cron
      // sweep, this job racing ahead of it would also make purgeOldTrash's
      // update throw on a row that's already gone.
      status: "COMMITTED",
    },
  });

  for (const file of staleFiles) {
    await deleteStoredFile(file.storageKey).catch((error) => {
      console.error(`Failed to delete disk blob for ${file.id}:`, error);
    });

    await prisma.$transaction(async (tx) => {
      await adjustOwnerUsedBytes(tx, file, -file.size);
      await tx.file.delete({ where: { id: file.id } });
    });
  }

  const emptyStaleSessions = await prisma.anonymousSession.deleteMany({
    where: {
      claimedByUserId: null,
      usedBytes: BigInt(0),
      lastSeenAt: { lt: cutoff },
      files: { none: {} },
      folders: { none: {} },
    },
  });

  return {
    retentionDays,
    filesRemoved: staleFiles.length,
    emptySessionsRemoved: emptyStaleSessions.count,
  };
}

export type PurgeTrashResult = { retentionDays: number; filesRemoved: number };

// Moves files that have sat in trash (status DELETED) past the retention
// window to PURGED — hidden from the owning user forever (getTrashedFiles
// only ever queries status DELETED), but the disk blob and DB row are
// deliberately kept so a superuser can still recover them from /backstage.
export async function purgeOldTrash(retentionDays = 30): Promise<PurgeTrashResult> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const trashedFiles = await prisma.file.findMany({
    where: { status: "DELETED", deletedAt: { lt: cutoff } },
  });

  let purgedCount = 0;
  for (const file of trashedFiles) {
    await prisma.$transaction(async (tx) => {
      // status: "DELETED" precondition baked into the update itself, not a
      // separate check — the file could have been restored by the owner
      // (deletedAt reset to null) or already purged by something else in
      // the moments between the findMany above and this transaction. Using
      // updateMany (which tolerates zero matches) instead of update (which
      // throws on a missing/non-matching row) means that race resolves as
      // a clean no-op rather than an unhandled rejection that would abort
      // this whole loop and the Promise.all it runs inside on the cron route.
      const { count } = await tx.file.updateMany({
        where: { id: file.id, status: "DELETED" },
        data: { status: "PURGED" },
      });
      if (count === 0) return;

      await adjustOwnerUsedBytes(tx, file, -file.size);
      purgedCount += 1;
    });
  }

  return { retentionDays, filesRemoved: purgedCount };
}
