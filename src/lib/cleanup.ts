import { prisma } from "./prisma";
import { deleteStoredFile } from "./storage";

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
    },
  });

  for (const file of staleFiles) {
    await deleteStoredFile(file.storageKey).catch((error) => {
      console.error(`Failed to delete disk blob for ${file.id}:`, error);
    });

    await prisma.$transaction(async (tx) => {
      if (file.anonymousSessionId) {
        await tx.anonymousSession.update({
          where: { id: file.anonymousSessionId },
          data: { usedBytes: { decrement: file.size } },
        });
      }
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
