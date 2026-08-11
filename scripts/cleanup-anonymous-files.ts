// Deletes files (and their disk blobs) from unclaimed anonymous sessions
// older than the retention window. Safe to run repeatedly. Shares its logic
// with src/app/api/cron/cleanup-anonymous/route.ts via src/lib/cleanup.ts —
// see that route for the scheduled/production trigger.
import "dotenv/config";
import { cleanupAnonymousFiles } from "../src/lib/cleanup.ts";
import { prisma } from "../src/lib/prisma.ts";

const RETENTION_DAYS = Number(process.argv[2] ?? 30);

cleanupAnonymousFiles(RETENTION_DAYS)
  .then(async (result) => {
    console.log(
      `Removed ${result.filesRemoved} anonymous file(s) and ${result.emptySessionsRemoved} empty stale session(s) (retention: ${result.retentionDays} days).`
    );
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
