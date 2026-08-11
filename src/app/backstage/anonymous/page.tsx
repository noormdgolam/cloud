import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBytes, formatRelativeDate } from "@/lib/format";
import { GlassCard } from "@/components/ui/GlassCard";

export const metadata = { title: "Backstage — Anonymous sessions" };

const PAGE_SIZE = 50;

export default async function BackstageAnonymous({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [sessions, total] = await Promise.all([
    prisma.anonymousSession.findMany({
      orderBy: { lastSeenAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        claimedByUser: { select: { email: true } },
        _count: { select: { files: true } },
      },
    }),
    prisma.anonymousSession.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <Link href="/backstage" className="flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to users
      </Link>

      <GlassCard className="p-0">
        <div className="border-b border-border p-4">
          <h1 className="text-sm font-semibold text-ink">
            Anonymous sessions <span className="text-ink-faint">({total})</span>
          </h1>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.08em] text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Session</th>
                <th className="px-4 py-2.5 font-medium">Used</th>
                <th className="px-4 py-2.5 font-medium">Files</th>
                <th className="px-4 py-2.5 font-medium">Claimed by</th>
                <th className="px-4 py-2.5 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">{s.id.slice(0, 12)}…</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                    {formatBytes(s.usedBytes)} / {formatBytes(s.quotaBytes)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">{s._count.files}</td>
                  <td className="px-4 py-3 text-xs text-ink-faint">{s.claimedByUser?.email ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-ink-faint">{formatRelativeDate(s.lastSeenAt)}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-faint">
                    No anonymous sessions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-ink-faint">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/backstage/anonymous?page=${page - 1}`} className="hover:text-ink">
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link href={`/backstage/anonymous?page=${page + 1}`} className="hover:text-ink">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
