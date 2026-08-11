// Creates a real account the same way registerUser() does (same bcrypt
// cost, same shape) — for when an account needs to exist without going
// through the browser signup form.
// Usage: npx tsx scripts/create-account.ts <email> <name> <password>
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error("Usage: npx tsx scripts/create-account.ts <email> <name> <password>");
    process.exitCode = 1;
    return;
  }

  const adapter = new PrismaMariaDb({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const prisma = new PrismaClient({ adapter });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`Account already exists for ${email}.`);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });
  console.log(`Created account for ${email} (id: ${user.id}).`);

  await prisma.$disconnect();
}

main();
