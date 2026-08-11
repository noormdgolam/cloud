// Grants (or revokes) /backstage admin access for a user by email.
// Usage:
//   npx tsx scripts/grant-admin.ts someone@example.com
//   npx tsx scripts/grant-admin.ts someone@example.com --revoke
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");

  if (!email) {
    console.error("Usage: npx tsx scripts/grant-admin.ts <email> [--revoke]");
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

  await prisma.user.update({
    where: { email },
    data: { isAdmin: !revoke },
  });

  console.log(revoke ? `${email} no longer has admin access.` : `${email} now has /backstage admin access.`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
