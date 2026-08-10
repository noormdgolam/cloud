// Deletes files (and their disk blobs) from unclaimed anonymous sessions
// older than the retention window. Intended to run on a schedule (cPanel
// Cron Jobs -> `node scripts/cleanup-anonymous-files.js <retention days>`
// against the built output, or `npx tsx scripts/cleanup-anonymous-files.ts`
// in dev). Safe to run repeatedly.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { deleteStoredFile } from "../src/lib/storage.ts";

const RETENTION_DAYS = Number(process.argv[2] ?? 30);

async function main() {
  const adapter = new PrismaMariaDb({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const prisma = new PrismaClient({ adapter });

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const staleFiles = await prisma.file.findMany({
    where: {
      anonymousSessionId: { not: null },
      createdAt: { lt: cutoff },
      anonymousSession: { claimedByUserId: null },
    },
  });

  console.log(
    `Found ${staleFiles.length} anonymous file(s) older than ${RETENTION_DAYS} days to remove.`
  );

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

    console.log(`Removed ${file.originalName} (${file.id})`);
  }

  // Also drop empty, long-abandoned, never-claimed anonymous sessions so the
  // table doesn't grow unbounded from visitors who never uploaded anything.
  const emptyStaleSessions = await prisma.anonymousSession.deleteMany({
    where: {
      claimedByUserId: null,
      usedBytes: BigInt(0),
      lastSeenAt: { lt: cutoff },
      files: { none: {} },
      folders: { none: {} },
    },
  });
  console.log(`Removed ${emptyStaleSessions.count} empty stale anonymous session row(s).`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
