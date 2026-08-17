import { prisma } from "@/lib/prisma";

export type BillingHistoryEntry = {
  id: string;
  date: Date;
  description: string;
  amount: number; // smallest currency unit
  currency: string;
  provider: string;
};

export async function getBillingHistory(userId: string, limit = 20): Promise<BillingHistoryEntry[]> {
  const [payments, addonPurchases] = await Promise.all([
    prisma.payment.findMany({
      where: { userId, status: "COMPLETED" },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.addonPurchase.findMany({
      where: { userId, status: "COMPLETED" },
      include: { pack: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const entries: BillingHistoryEntry[] = [
    ...payments.map((p) => ({
      id: p.id,
      date: p.updatedAt,
      description: p.plan.name,
      amount: p.amount,
      currency: p.currency,
      provider: p.provider,
    })),
    ...addonPurchases.map((a) => ({
      id: a.id,
      date: a.updatedAt,
      description: `${a.pack.name} add-on`,
      amount: a.amount,
      currency: a.currency,
      provider: a.provider,
    })),
  ];

  return entries.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
}
