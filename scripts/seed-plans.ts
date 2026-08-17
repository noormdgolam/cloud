// Seeds/updates the paid storage tiers. Safe to re-run — upserts by id.
// Usage: npx tsx scripts/seed-plans.ts
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const GiB = 1024 ** 3;

// Priced under 30% of Google One's equivalent tier (100GB $1.99, 2TB $9.99
// as of Aug 2026). BDT prices are set directly as clean round numbers
// rather than live-converted, so bKash checkout never shows an odd amount.
const MONTHLY_PLANS = [
  { id: "plan_100gb", name: "100GB", quotaBytes: BigInt(100 * GiB), priceUsdCents: 49, priceBdtPoisha: 6000 },
  { id: "plan_500gb", name: "500GB", quotaBytes: BigInt(500 * GiB), priceUsdCents: 149, priceBdtPoisha: 18000 },
  { id: "plan_2tb", name: "2TB", quotaBytes: BigInt(2048 * GiB), priceUsdCents: 249, priceBdtPoisha: 30000 },
  // Higher-ARPU tier aimed at power users/small teams as the userbase grows —
  // same recurring Plan/Subscription machinery, no new billing code needed.
  { id: "plan_5tb_business", name: "5TB Business", quotaBytes: BigInt(5120 * GiB), priceUsdCents: 699, priceBdtPoisha: 84000 },
];

// Annual variants: pay for 10 months, get 12 (~17% off) — standard SaaS
// prepay discount that improves cash flow and cuts churn as the base grows.
const ANNUAL_MONTHS_CHARGED = 10;

const PLANS = [
  ...MONTHLY_PLANS.map((p) => ({ ...p, billingPeriodDays: 30 })),
  ...MONTHLY_PLANS.map((p) => ({
    id: `${p.id}_yearly`,
    name: `${p.name} (yearly)`,
    quotaBytes: p.quotaBytes,
    priceUsdCents: p.priceUsdCents * ANNUAL_MONTHS_CHARGED,
    priceBdtPoisha: p.priceBdtPoisha * ANNUAL_MONTHS_CHARGED,
    billingPeriodDays: 365,
  })),
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

  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      create: { ...plan, active: true },
      update: plan,
    });
    const unit = plan.billingPeriodDays >= 365 ? "yr" : "mo";
    console.log(`${plan.name}: $${(plan.priceUsdCents / 100).toFixed(2)}/${unit} · ৳${(plan.priceBdtPoisha / 100).toFixed(0)}/${unit}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
