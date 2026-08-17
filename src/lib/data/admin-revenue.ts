import { prisma } from "@/lib/prisma";

export async function getRevenueOverview() {
  const [
    paymentsByCurrency,
    addonsByCurrency,
    activeSubscriptions,
    planBreakdown,
    recentPayments,
    recentAddons,
  ] = await Promise.all([
    prisma.payment.groupBy({
      by: ["currency"],
      where: { status: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.addonPurchase.groupBy({
      by: ["currency"],
      where: { status: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.subscription.count({
      where: { status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    }),
    prisma.payment.groupBy({
      by: ["planId"],
      where: { status: "COMPLETED" },
      _count: true,
      orderBy: { _count: { planId: "desc" } },
    }),
    prisma.payment.findMany({
      where: { status: "COMPLETED" },
      include: { plan: true, user: { select: { email: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.addonPurchase.findMany({
      where: { status: "COMPLETED" },
      include: { pack: true, user: { select: { email: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  const plans = await prisma.plan.findMany({ where: { id: { in: planBreakdown.map((p) => p.planId) } } });
  const planNameById = new Map(plans.map((p) => [p.id, p.name]));

  const revenueByCurrency = new Map<string, { amount: number; count: number }>();
  for (const row of paymentsByCurrency) {
    const existing = revenueByCurrency.get(row.currency) ?? { amount: 0, count: 0 };
    revenueByCurrency.set(row.currency, {
      amount: existing.amount + (row._sum.amount ?? 0),
      count: existing.count + row._count,
    });
  }
  for (const row of addonsByCurrency) {
    const existing = revenueByCurrency.get(row.currency) ?? { amount: 0, count: 0 };
    revenueByCurrency.set(row.currency, {
      amount: existing.amount + (row._sum.amount ?? 0),
      count: existing.count + row._count,
    });
  }

  const activity = [
    ...recentPayments.map((p) => ({
      id: p.id,
      date: p.updatedAt,
      description: p.plan.name,
      email: p.user.email,
      amount: p.amount,
      currency: p.currency,
      provider: p.provider,
    })),
    ...recentAddons.map((a) => ({
      id: a.id,
      date: a.updatedAt,
      description: `${a.pack.name} add-on`,
      email: a.user.email,
      amount: a.amount,
      currency: a.currency,
      provider: a.provider,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10);

  return {
    revenueByCurrency: Array.from(revenueByCurrency.entries()).map(([currency, v]) => ({ currency, ...v })),
    activeSubscriptions,
    addonPurchaseCount: addonsByCurrency.reduce((sum, r) => sum + r._count, 0),
    planBreakdown: planBreakdown.map((p) => ({
      planName: planNameById.get(p.planId) ?? p.planId,
      count: p._count,
    })),
    activity,
  };
}
