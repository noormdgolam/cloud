import { prisma } from "@/lib/prisma";

export type CreatorStats = {
  totalViews: bigint;
  balancePoisha: number;
  enabled: boolean;
  recentLedger: { id: string; type: "CREDIT" | "PAYOUT"; amountPoisha: number; note: string | null; createdAt: Date }[];
};

export async function getCreatorStats(userId: string): Promise<CreatorStats> {
  const [viewAgg, user, recentLedger] = await Promise.all([
    prisma.file.aggregate({ where: { userId, status: "COMMITTED" }, _sum: { viewCount: true } }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creatorBalancePoisha: true, creatorProgramEnabled: true },
    }),
    prisma.creatorLedgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, type: true, amountPoisha: true, note: true, createdAt: true },
    }),
  ]);

  return {
    totalViews: viewAgg._sum.viewCount ?? BigInt(0),
    balancePoisha: user.creatorBalancePoisha,
    enabled: user.creatorProgramEnabled,
    recentLedger,
  };
}
