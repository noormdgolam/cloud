import Link from "next/link";
import { ShieldAlert, ShieldCheck, AlertTriangle, Sparkles, Image } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getModerationStats } from "@/lib/moderation/vision-moderator";
import { GlassCard } from "@/components/ui/GlassCard";
import { ModerationClient, type ModeratedFileItem } from "@/components/backstage/ModerationClient";

export const metadata = { title: "Backstage — NSFW & Adult Content Moderation" };

const PAGE_SIZE = 24;

function StatCard({
  icon: Icon,
  label,
  value,
  variant = "default",
}: {
  icon: typeof ShieldAlert;
  label: string;
  value: string | number;
  variant?: "default" | "danger" | "warning" | "success";
}) {
  const colorClass =
    variant === "danger"
      ? "text-danger"
      : variant === "warning"
      ? "text-warning"
      : variant === "success"
      ? "text-accent-2"
      : "text-ink";

  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2 text-ink-faint">
        <Icon className={`size-3.5 ${colorClass}`} strokeWidth={1.75} aria-hidden />
        <span className="text-xs uppercase tracking-[0.1em]">{label}</span>
      </div>
      <p className={`mt-2 font-mono text-xl font-semibold ${colorClass}`}>{value}</p>
    </GlassCard>
  );
}

export default async function BackstageModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  await requireAdmin();
  const { tab = "flagged", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const stats = await getModerationStats();

  let whereClause: Record<string, unknown> = {
    status: "COMMITTED",
    mimeType: { startsWith: "image/" },
  };

  if (tab === "flagged") {
    whereClause = {
      ...whereClause,
      moderation: {
        status: { in: ["FLAGGED_ADULT", "FLAGGED_SUGGESTIVE"] },
      },
    };
  } else if (tab === "adult") {
    whereClause = {
      ...whereClause,
      moderation: {
        status: "FLAGGED_ADULT",
      },
    };
  } else if (tab === "suggestive") {
    whereClause = {
      ...whereClause,
      moderation: {
        status: "FLAGGED_SUGGESTIVE",
      },
    };
  } else if (tab === "safe") {
    whereClause = {
      ...whereClause,
      moderation: {
        status: "SAFE",
      },
    };
  } else if (tab === "unscanned") {
    whereClause = {
      ...whereClause,
      OR: [
        { moderation: null },
        { moderation: { status: "UNSCANNED" } },
      ],
    };
  }

  const [filesRaw, matchCount] = await Promise.all([
    prisma.file.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        originalName: true,
        size: true,
        mimeType: true,
        createdAt: true,
        userId: true,
        anonymousSessionId: true,
        user: { select: { name: true, email: true } },
        moderation: {
          select: {
            status: true,
            confidence: true,
            category: true,
            reason: true,
            scannedAt: true,
          },
        },
      },
    }),
    prisma.file.count({ where: whereClause }),
  ]);

  const files: ModeratedFileItem[] = filesRaw.map((f) => ({
    id: f.id,
    originalName: f.originalName,
    size: f.size,
    mimeType: f.mimeType,
    createdAt: f.createdAt,
    userId: f.userId,
    userName: f.user?.name ?? null,
    userEmail: f.user?.email ?? null,
    anonymousSessionId: f.anonymousSessionId,
    moderation: f.moderation
      ? {
          status: f.moderation.status,
          confidence: f.moderation.confidence,
          category: f.moderation.category,
          reason: f.moderation.reason,
          scannedAt: f.moderation.scannedAt,
        }
      : null,
  }));

  const totalPages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header (AEO Answer-First) ── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-ink">
          What is the NSFW & Adult Image Moderation System?
        </h1>
        <p className="text-sm text-ink-muted leading-relaxed max-w-3xl">
          Automated Vision AI scanner that detects explicit nudity, sexually suggestive imagery, and sensitive media across all uploaded user files with instant review, false-positive override, and bulk deletion tools.
        </p>
      </div>

      {/* ── Statistics Summary ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard icon={Image} label="Total Images" value={stats.totalImages} />
        <StatCard icon={ShieldCheck} label="Scanned" value={stats.scannedCount} variant="success" />
        <StatCard icon={ShieldAlert} label="Adult Flagged" value={stats.flaggedAdult} variant="danger" />
        <StatCard icon={AlertTriangle} label="Suggestive" value={stats.flaggedSuggestive} variant="warning" />
        <StatCard icon={Sparkles} label="Pending Scan" value={stats.pendingCount} />
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3 text-xs font-medium">
        <Link
          href="/backstage/moderation?tab=flagged"
          className={`rounded-xl px-3 py-1.5 transition-colors ${
            tab === "flagged"
              ? "bg-danger/10 text-danger border border-danger/30"
              : "text-ink-muted hover:text-ink hover:bg-bg-2"
          }`}
        >
          Flagged ({stats.totalFlagged})
        </Link>
        <Link
          href="/backstage/moderation?tab=adult"
          className={`rounded-xl px-3 py-1.5 transition-colors ${
            tab === "adult"
              ? "bg-danger/10 text-danger border border-danger/30"
              : "text-ink-muted hover:text-ink hover:bg-bg-2"
          }`}
        >
          Explicit Adult ({stats.flaggedAdult})
        </Link>
        <Link
          href="/backstage/moderation?tab=suggestive"
          className={`rounded-xl px-3 py-1.5 transition-colors ${
            tab === "suggestive"
              ? "bg-warning/10 text-warning border border-warning/30"
              : "text-ink-muted hover:text-ink hover:bg-bg-2"
          }`}
        >
          Suggestive ({stats.flaggedSuggestive})
        </Link>
        <Link
          href="/backstage/moderation?tab=unscanned"
          className={`rounded-xl px-3 py-1.5 transition-colors ${
            tab === "unscanned"
              ? "bg-accent/10 text-accent-2 border border-accent/30"
              : "text-ink-muted hover:text-ink hover:bg-bg-2"
          }`}
        >
          Unscanned ({stats.pendingCount})
        </Link>
        <Link
          href="/backstage/moderation?tab=safe"
          className={`rounded-xl px-3 py-1.5 transition-colors ${
            tab === "safe"
              ? "bg-accent/10 text-accent-2 border border-accent/30"
              : "text-ink-muted hover:text-ink hover:bg-bg-2"
          }`}
        >
          Safe
        </Link>
        <Link
          href="/backstage/moderation?tab=all"
          className={`rounded-xl px-3 py-1.5 transition-colors ${
            tab === "all"
              ? "bg-bg-3 text-ink border border-border"
              : "text-ink-muted hover:text-ink hover:bg-bg-2"
          }`}
        >
          All Images ({stats.totalImages})
        </Link>
      </div>

      {/* ── Moderation Client Feed ── */}
      <ModerationClient files={files} pendingCount={stats.pendingCount} />

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-ink-faint">
          <span>
            Page {page} of {totalPages} ({matchCount} matching images)
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/backstage/moderation?tab=${tab}&page=${page - 1}`}
                className="rounded-lg border border-border px-3 py-1 text-ink hover:bg-bg-2"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/backstage/moderation?tab=${tab}&page=${page + 1}`}
                className="rounded-lg border border-border px-3 py-1 text-ink hover:bg-bg-2"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
