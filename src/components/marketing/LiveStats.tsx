import { prisma } from "@/lib/prisma";
import { formatBytes } from "@/lib/format";

async function getStats() {
  try {
    const [userCount, fileAgg] = await Promise.all([
      prisma.user.count(),
      prisma.file.aggregate({ where: { status: "COMMITTED" }, _sum: { size: true }, _count: true }),
    ]);
    return { userCount, fileCount: fileAgg._count, totalBytes: fileAgg._sum.size ?? BigInt(0) };
  } catch {
    // Marketing chrome should never take the homepage down with it — a DB
    // hiccup here just means the strip doesn't render this request.
    return null;
  }
}

export async function LiveStats() {
  const stats = await getStats();
  if (!stats || stats.fileCount === 0) return null;

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 lg:justify-start">
      <Stat value={stats.userCount.toLocaleString()} label={stats.userCount === 1 ? "real account" : "real accounts"} />
      <div className="hidden h-8 w-px bg-border sm:block" aria-hidden />
      <Stat value={formatBytes(stats.totalBytes)} label="stored right now" />
      <div className="hidden h-8 w-px bg-border sm:block" aria-hidden />
      <Stat value={stats.fileCount.toLocaleString()} label={stats.fileCount === 1 ? "file kept safe" : "files kept safe"} />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center lg:items-start">
      <span className="font-mono text-lg font-semibold tracking-tight text-ink">{value}</span>
      <span className="text-xs text-ink-faint">{label}</span>
    </div>
  );
}
