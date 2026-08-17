import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBytes, formatRelativeDate } from "@/lib/format";
import { mimeIcon } from "@/lib/mime-icon";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toggleUnlimited, toggleAdmin, addCreatorLedgerEntry } from "@/lib/actions/admin-actions";
import { AdminResetPasswordForm } from "@/components/backstage/AdminResetPasswordForm";
import { Input } from "@/components/ui/Input";

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
      // Every recoverable status — including files the user has trashed or
      // "deleted forever", which are only ever PURGED (hidden from them),
      // never actually removed. A superuser can still see and pull all of it.
      files: {
        where: { status: { in: ["COMMITTED", "DELETED", "PURGED"] } },
        orderBy: { createdAt: "desc" },
        include: { folder: { select: { name: true } } },
      },
      creatorLedger: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { folders: true } },
    },
  });

  if (!user) notFound();

  const committedCount = user.files.filter((f) => f.status === "COMMITTED").length;
  const totalViews = user.files.reduce((sum, f) => sum + f.viewCount, BigInt(0));
  const toggleUnlimitedAction = toggleUnlimited.bind(null, user.id, user.quotaBytes !== null);
  const toggleAdminAction = toggleAdmin.bind(null, user.id, !user.isAdmin);
  const addLedgerAction = addCreatorLedgerEntry.bind(null, user.id);

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
              {user.quotaBytes === null ? "unlimited" : formatBytes(user.quotaBytes)} · {committedCount}{" "}
              files · {user._count.folders} folders · joined {formatRelativeDate(user.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/backstage/vault?userId=${user.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/30 px-4 py-2 text-xs font-medium text-accent-2 hover:bg-accent/20 transition-colors"
            >
              <Sparkles className="size-3.5" aria-hidden />
              Open Special Media Vault
            </Link>
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

      {user.passwordHash && (
        <GlassCard className="p-5">
          <h2 className="text-sm font-semibold text-ink">Set a new password</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Stopgap for locked-out users until there&apos;s a self-service email reset flow.
          </p>
          <div className="mt-3">
            <AdminResetPasswordForm userId={user.id} />
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-5">
        <h2 className="text-sm font-semibold text-ink">Creator earnings</h2>
        <p className="mt-1 font-mono text-xs text-ink-faint">
          {totalViews.toLocaleString()} total views · balance ৳{(user.creatorBalancePoisha / 100).toFixed(2)}
        </p>

        <form action={addLedgerAction} className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-ink-muted" htmlFor="type">
              Type
            </label>
            <select
              id="type"
              name="type"
              className="rounded-lg border border-border bg-bg-2 px-2.5 py-2 text-sm text-ink"
            >
              <option value="CREDIT">Credit (earned)</option>
              <option value="PAYOUT">Payout (sent)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted" htmlFor="amountBdt">
              Amount (৳)
            </label>
            <Input id="amountBdt" name="amountBdt" type="number" min="0.01" step="0.01" required className="w-28" />
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className="mb-1 block text-xs text-ink-muted" htmlFor="note">
              Note
            </label>
            <Input id="note" name="note" placeholder="e.g. Adsterra Jan 2026, pro-rata share" />
          </div>
          <Button type="submit" variant="ghost" className="px-4 py-2 text-xs">
            Add entry
          </Button>
        </form>

        {user.creatorLedger.length > 0 && (
          <div className="mt-4 flex flex-col gap-0.5 border-t border-border pt-3">
            {user.creatorLedger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate text-ink-muted">
                  {entry.type === "CREDIT" ? "Credit" : "Payout"}
                  {entry.note ? ` — ${entry.note}` : ""} · {formatRelativeDate(entry.createdAt)}
                </span>
                <span className={`shrink-0 font-mono ${entry.type === "CREDIT" ? "text-accent" : "text-ink-faint"}`}>
                  {entry.type === "CREDIT" ? "+" : "-"}৳{(entry.amountPoisha / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold text-ink">Files (Immutable Audit Vault)</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            Preserves every file uploaded by this user (Active, Trashed, and Purged). Files in Backstage are strictly permanent and cannot be deleted.
          </p>
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
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm text-ink">{file.originalName}</span>
                    {file.status === "DELETED" && (
                      <Badge className="shrink-0 border-warning/40 text-warning">trashed</Badge>
                    )}
                    {file.status === "PURGED" && (
                      <Badge className="shrink-0 border-danger/40 text-danger">purged</Badge>
                    )}
                  </span>
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
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

