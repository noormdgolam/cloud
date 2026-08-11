import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBytes, formatRelativeDate } from "@/lib/format";
import { mimeIcon } from "@/lib/mime-icon";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toggleUnlimited, toggleAdmin, adminDeleteFile } from "@/lib/actions/admin-actions";

export const metadata = { title: "Backstage — User" };

export default async function BackstageUserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      files: {
        where: { status: "COMMITTED" },
        orderBy: { createdAt: "desc" },
        include: { folder: { select: { name: true } } },
      },
      _count: { select: { folders: true } },
    },
  });

  if (!user) notFound();

  const toggleUnlimitedAction = toggleUnlimited.bind(null, user.id, user.quotaBytes !== null);
  const toggleAdminAction = toggleAdmin.bind(null, user.id, !user.isAdmin);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/backstage" className="flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to users
      </Link>

      <GlassCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-ink">{user.name ?? "Unnamed"}</h1>
              {user.isAdmin && <Badge className="border-danger/40 text-danger">admin</Badge>}
            </div>
            <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
            <p className="mt-3 font-mono text-xs text-ink-faint">
              {formatBytes(user.usedBytes)} used of{" "}
              {user.quotaBytes === null ? "unlimited" : formatBytes(user.quotaBytes)} · {user.files.length}{" "}
              files · {user._count.folders} folders · joined {formatRelativeDate(user.createdAt)}
            </p>
          </div>
          <div className="flex gap-2">
            <form action={toggleUnlimitedAction}>
              <Button type="submit" variant="ghost" className="px-4 py-2 text-xs">
                {user.quotaBytes === null ? "Revoke unlimited" : "Grant unlimited"}
              </Button>
            </form>
            <form action={toggleAdminAction}>
              <Button type="submit" variant="ghost" className="px-4 py-2 text-xs">
                {user.isAdmin ? "Revoke admin" : "Grant admin"}
              </Button>
            </form>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold text-ink">Files</h2>
        </div>
        {user.files.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-faint">No files.</p>
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {user.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-xl px-3.5 py-3 hover:bg-[var(--glass-surface-hover)]"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-2">
                  {mimeIcon(file.mimeType, "size-4 text-ink-muted")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{file.originalName}</span>
                  <span className="block text-xs text-ink-faint">
                    {file.folder?.name ?? "Root"} · {formatRelativeDate(file.createdAt)}
                  </span>
                </span>
                <span className="font-mono text-xs text-ink-faint">{formatBytes(file.size)}</span>
                <a
                  href={`/api/backstage/files/${file.id}/download`}
                  className="rounded-lg p-1.5 text-ink-faint hover:bg-[var(--glass-surface-hover)] hover:text-ink"
                  title={`Download ${file.originalName}`}
                >
                  <Download className="size-4" aria-hidden />
                </a>
                <form action={adminDeleteFile.bind(null, file.id)}>
                  <button
                    type="submit"
                    className="rounded-lg p-1.5 text-ink-faint hover:bg-danger/10 hover:text-danger"
                    title={`Delete ${file.originalName}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
