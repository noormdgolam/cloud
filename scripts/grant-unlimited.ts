// Grants (or revokes) unlimited storage for a user by email.
// Usage:
//   npx tsx scripts/grant-unlimited.ts someone@example.com
//   npx tsx scripts/grant-unlimited.ts someone@example.com --revoke
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const DEFAULT_QUOTA_BYTES = BigInt(26843545600); // 25 GiB

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");

  if (!email) {
    console.error("Usage: npx tsx scripts/grant-unlimited.ts <email> [--revoke]");
    process.exitCode = 1;
    return;
  }

  const adapter = new PrismaMariaDb({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const prisma = new PrismaClient({ adapter });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email ${email}. They need to sign up first.`);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { quotaBytes: revoke ? DEFAULT_QUOTA_BYTES : null },
  });

  console.log(
    revoke
      ? `${email} is back on the standard 25GB quota.`
      : `${email} now has unlimited storage.`
  );
  console.log("Current usage:", updated.usedBytes.toString(), "bytes");

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
