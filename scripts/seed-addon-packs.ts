// Seeds/updates one-time storage top-up packs. Safe to re-run — upserts by id.
// Usage: npx tsx scripts/seed-addon-packs.ts
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const GiB = 1024 ** 3;

const PACKS = [
  { id: "addon_20gb", name: "+20GB", bonusBytes: BigInt(20 * GiB), priceUsdCents: 29, priceBdtPoisha: 3500 },
  { id: "addon_100gb", name: "+100GB", bonusBytes: BigInt(100 * GiB), priceUsdCents: 99, priceBdtPoisha: 12000 },
  { id: "addon_500gb", name: "+500GB", bonusBytes: BigInt(500 * GiB), priceUsdCents: 399, priceBdtPoisha: 48000 },
];

async function main() {
  const adapter = new PrismaMariaDb({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const prisma = new PrismaClient({ adapter });

  for (const pack of PACKS) {
    await prisma.addonPack.upsert({
      where: { id: pack.id },
      create: { ...pack, active: true },
      update: pack,
    });
    console.log(`${pack.name}: $${(pack.priceUsdCents / 100).toFixed(2)} · ৳${(pack.priceBdtPoisha / 100).toFixed(0)} (one-time)`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
