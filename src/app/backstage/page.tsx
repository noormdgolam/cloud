import Link from "next/link";
import { Users, HardDrive, Files, UserX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBytes, formatRelativeDate } from "@/lib/format";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

export const metadata = { title: "Backstage — Overview" };

const PAGE_SIZE = 25;

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2 text-ink-faint">
        <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
        <span className="text-xs uppercase tracking-[0.1em]">{label}</span>
      </div>
      <p className="mt-2 font-mono text-xl text-ink">{value}</p>
    </GlassCard>
  );
}

export default async function BackstageOverview({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const query = (q ?? "").trim();
  const page = Math.max(1, Number(pageParam) || 1);

  const [userCount, anonCount, fileAgg, usersOnPage, matchCount] = await Promise.all([
    prisma.user.count(),
    prisma.anonymousSession.count(),
    prisma.file.aggregate({ where: { status: "COMMITTED" }, _sum: { size: true }, _count: true }),
    prisma.user.findMany({
      where: query
        ? { OR: [{ email: { contains: query } }, { name: { contains: query } }] }
        : undefined,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        usedBytes: true,
        quotaBytes: true,
        isAdmin: true,
        createdAt: true,
        _count: { select: { files: true } },
      },
    }),
    prisma.user.count({
      where: query
        ? { OR: [{ email: { contains: query } }, { name: { contains: query } }] }
        : undefined,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="Users" value={String(userCount)} />
        <StatCard icon={UserX} label="Anonymous sessions" value={String(anonCount)} />
        <StatCard icon={Files} label="Committed files" value={String(fileAgg._count)} />
        <StatCard icon={HardDrive} label="Total stored" value={formatBytes(fileAgg._sum.size ?? 0)} />
      </div>

      <GlassCard className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h1 className="text-sm font-semibold text-ink">Users</h1>
          <form className="w-full max-w-xs sm:w-auto">
            <Input
              type="search"
              name="q"
              placeholder="Search name or email…"
              defaultValue={query}
              className="text-sm"
            />
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.08em] text-ink-faint">
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 font-medium">Used</th>
                <th className="px-4 py-2.5 font-medium">Files</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {usersOnPage.map((user) => (
                <tr key={user.id} className="border-t border-border hover:bg-[var(--glass-surface-hover)]">
                  <td className="px-4 py-3">
                    <Link href={`/backstage/users/${user.id}`} className="flex items-center gap-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-ink">{user.name ?? "—"}</span>
                        <span className="block truncate text-xs text-ink-faint">{user.email}</span>
                      </span>
                      {user.isAdmin && (
                        <Badge className="border-danger/40 text-danger">admin</Badge>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                    {user.quotaBytes === null ? "Unlimited" : formatBytes(user.quotaBytes)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                    {formatBytes(user.usedBytes)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">{user._count.files}</td>
                  <td className="px-4 py-3 text-xs text-ink-faint">
                    {formatRelativeDate(user.createdAt)}
                  </td>
                </tr>
              ))}
              {usersOnPage.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-faint">
                    No users match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-ink-faint">
            <span>
              Page {page} of {totalPages} ({matchCount} users)
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/backstage?q=${encodeURIComponent(query)}&page=${page - 1}`}
                  className="hover:text-ink"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/backstage?q=${encodeURIComponent(query)}&page=${page + 1}`}
                  className="hover:text-ink"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      <Link href="/backstage/anonymous" className="text-sm text-ink-muted hover:text-ink">
        View anonymous sessions →
      </Link>
    </div>
  );
}
