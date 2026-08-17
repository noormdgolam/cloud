import Link from "next/link";
import {
  Users,
  Image as ImageIcon,
  Video,
  Lock,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatBytes, formatRelativeDate } from "@/lib/format";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { VaultGalleryClient, type VaultMediaItem } from "@/components/backstage/VaultGalleryClient";

export const metadata = { title: "Backstage — Special Media Vault" };

export default async function BackstageVaultPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  await requireAdmin();
  const { userId } = await searchParams;

  const [allUsers, selectedUser, filesRaw] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        _count: { select: { files: true } },
      },
    }),
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          include: {
            _count: { select: { files: true, folders: true } },
          },
        })
      : null,
    prisma.file.findMany({
      where: {
        status: { in: ["COMMITTED", "DELETED", "PURGED"] },
        userId: userId ? userId : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        originalName: true,
        size: true,
        mimeType: true,
        status: true,
        createdAt: true,
        checksumSha256: true,
        userId: true,
        folder: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  const files: VaultMediaItem[] = filesRaw.map((f) => ({
    id: f.id,
    originalName: f.originalName,
    size: f.size,
    mimeType: f.mimeType,
    status: f.status as "COMMITTED" | "DELETED" | "PURGED",
    createdAt: f.createdAt,
    folderName: f.folder?.name ?? null,
    checksumSha256: f.checksumSha256,
    userId: f.userId,
    userName: f.user?.name ?? null,
    userEmail: f.user?.email ?? null,
  }));

  const photoCount = files.filter((f) => f.mimeType.startsWith("image/")).length;
  const videoCount = files.filter((f) => f.mimeType.startsWith("video/")).length;
  const trashedCount = files.filter((f) => f.status === "DELETED").length;
  const purgedCount = files.filter((f) => f.status === "PURGED").length;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header (AEO Answer-First) ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent/10 text-accent-2 border border-accent/20">
            <Lock className="size-4" aria-hidden />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            What is the Backstage Special Media Vault?
          </h1>
        </div>
        <p className="text-sm text-ink-muted leading-relaxed max-w-3xl">
          A secure, immutable audit vault where administrators can inspect user accounts, browse high-resolution photos and stream videos. All files are permanently preserved and cannot be deleted from Backstage.
        </p>
      </div>

      {/* ── User Directory Selector ── */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-ink">
            <Users className="size-4 text-accent-2" aria-hidden />
            <span className="text-sm font-semibold">Select User Vault</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/backstage/vault"
              className={`rounded-xl px-3 py-1.5 transition-colors ${
                !userId
                  ? "bg-accent text-white"
                  : "border border-border bg-bg-3 text-ink hover:bg-bg-1"
              }`}
            >
              All Users ({allUsers.length})
            </Link>

            <form method="GET" action="/backstage/vault" className="flex items-center">
              <select
                name="userId"
                defaultValue={userId ?? ""}
                onChange={(e) => {
                  if (e.target.form) e.target.form.submit();
                }}
                className="rounded-xl border border-border bg-bg-3 px-3 py-1.5 text-xs text-ink focus:outline-none"
                aria-label="Select user to inspect"
              >
                <option value="">-- Browse by User --</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email} ({u._count.files} files)
                  </option>
                ))}
              </select>
            </form>
          </div>
        </div>
      </GlassCard>

      {/* ── Selected User Details Banner ── */}
      {selectedUser && (
        <GlassCard className="p-5 border-accent/30 bg-accent/5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink">{selectedUser.name ?? "Unnamed"}</h2>
                {selectedUser.isAdmin && <Badge className="border-danger/40 text-danger">admin</Badge>}
                <Badge className="border-accent/40 bg-accent/10 text-accent-2">
                  {selectedUser.quotaBytes === null ? "Unlimited Plan" : "Standard Plan"}
                </Badge>
              </div>

              <p className="text-sm text-ink-muted">{selectedUser.email}</p>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-ink-faint">
                <span>Used: {formatBytes(selectedUser.usedBytes)}</span>
                <span>·</span>
                <span>Active: {selectedUser._count.files} files</span>
                <span>·</span>
                <span>Folders: {selectedUser._count.folders}</span>
                <span>·</span>
                <span>Joined: {formatRelativeDate(selectedUser.createdAt)}</span>
                <span>·</span>
                <span>User ID: {selectedUser.id}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/backstage/users/${selectedUser.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-bg-2 px-3.5 py-2 text-xs font-medium text-ink hover:bg-bg-1 transition-colors"
              >
                Account Settings & Password
              </Link>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ── Quick Stats Summary ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <GlassCard className="p-3.5">
          <span className="text-[11px] uppercase tracking-wider text-ink-faint block">Total Preserved</span>
          <span className="font-mono text-lg font-semibold text-ink">{files.length}</span>
        </GlassCard>
        <GlassCard className="p-3.5">
          <span className="text-[11px] uppercase tracking-wider text-accent-2 block flex items-center gap-1">
            <ImageIcon className="size-3" aria-hidden /> Photos
          </span>
          <span className="font-mono text-lg font-semibold text-accent-2">{photoCount}</span>
        </GlassCard>
        <GlassCard className="p-3.5">
          <span className="text-[11px] uppercase tracking-wider text-accent-2 block flex items-center gap-1">
            <Video className="size-3" aria-hidden /> Videos
          </span>
          <span className="font-mono text-lg font-semibold text-accent-2">{videoCount}</span>
        </GlassCard>
        <GlassCard className="p-3.5">
          <span className="text-[11px] uppercase tracking-wider text-warning block">Trashed Files</span>
          <span className="font-mono text-lg font-semibold text-warning">{trashedCount}</span>
        </GlassCard>
        <GlassCard className="p-3.5">
          <span className="text-[11px] uppercase tracking-wider text-danger block">Purged Files</span>
          <span className="font-mono text-lg font-semibold text-danger">{purgedCount}</span>
        </GlassCard>
      </div>

      {/* ── Media Gallery Grid ── */}
      <VaultGalleryClient files={files} />
    </div>
  );
}
