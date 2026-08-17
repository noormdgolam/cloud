"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  Download,
  CheckCircle,
  RotateCw,
  Sparkles,
  Loader2,
} from "lucide-react";
import { formatBytes, formatRelativeDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  adminScanFileModeration,
  adminScanBatchModeration,
  adminMarkModerationStatus,
} from "@/lib/actions/admin-actions";

export type ModeratedFileItem = {
  id: string;
  originalName: string;
  size: bigint;
  mimeType: string;
  createdAt: Date;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  anonymousSessionId: string | null;
  moderation: {
    status: "UNSCANNED" | "SAFE" | "FLAGGED_ADULT" | "FLAGGED_SUGGESTIVE" | "ERROR";
    confidence: number | null;
    category: string | null;
    reason: string | null;
    scannedAt: Date;
  } | null;
};

export function ModerationClient({
  files,
  pendingCount,
}: {
  files: ModeratedFileItem[];
  pendingCount: number;
}) {
  const router = useRouter();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [scanningBatch, setScanningBatch] = useState(false);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function toggleReveal(id: string) {
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleBatchScan(limit: number) {
    setScanningBatch(true);
    setFeedback(null);
    try {
      const summary = await adminScanBatchModeration(limit);
      setFeedback(
        `Scanned ${summary.scannedCount} images: ${summary.flagged} flagged, ${summary.safe} safe, ${summary.errors} errors.`
      );
      router.refresh();
    } catch (err) {
      setFeedback(`Batch scan error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanningBatch(false);
    }
  }

  async function handleSingleScan(fileId: string) {
    setActiveScanId(fileId);
    try {
      await adminScanFileModeration(fileId);
      router.refresh();
    } catch (err) {
      setFeedback(`Scan error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActiveScanId(null);
    }
  }

  async function handleMarkSafe(fileId: string) {
    try {
      await adminMarkModerationStatus(fileId, "SAFE");
      router.refresh();
    } catch (err) {
      setFeedback(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-bg-2/50 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="accent"
            disabled={scanningBatch || pendingCount === 0}
            onClick={() => handleBatchScan(10)}
            className="gap-2 px-3 py-1.5 text-xs"
            data-mcp-action="scan-pending-batch"
          >
            {scanningBatch ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            Scan 10 Pending ({pendingCount} left)
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={scanningBatch || pendingCount === 0}
            onClick={() => handleBatchScan(25)}
            className="gap-2 px-3 py-1.5 text-xs"
            data-mcp-action="scan-pending-batch-25"
          >
            Scan 25 Pending
          </Button>
        </div>

        <span className="text-xs text-ink-faint">
          Immutable Vault — Backstage preserves all files permanently
        </span>
      </div>

      {feedback && (
        <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs text-accent-2">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Files Grid ── */}
      {files.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1 text-xs text-ink-faint">
            <span>Showing {files.length} items</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((file) => {
              const isFlagged =
                file.moderation?.status === "FLAGGED_ADULT" ||
                file.moderation?.status === "FLAGGED_SUGGESTIVE";
              const isRevealed = Boolean(revealed[file.id]);
              const isScanning = activeScanId === file.id;

              return (
                <div
                  key={file.id}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all ${
                    isFlagged
                      ? "border-danger/40 bg-bg-2/80 hover:border-danger"
                      : "border-border bg-bg-2/50 hover:border-border-hover"
                  }`}
                >
                  {/* Card Header */}
                  <div className="relative aspect-video w-full overflow-hidden bg-bg-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/backstage/files/${file.id}/download?inline=1`}
                      alt={file.originalName}
                      className={`size-full object-cover transition-all duration-300 ${
                        !isRevealed && isFlagged ? "scale-105 blur-2xl filter brightness-50" : ""
                      }`}
                      loading="lazy"
                    />

                    {/* Sensitivity Overlay Warning */}
                    {!isRevealed && isFlagged && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <ShieldAlert className="size-6 text-danger" aria-hidden />
                        <span className="text-xs font-semibold text-danger">Sensitive Content</span>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => toggleReveal(file.id)}
                          className="mt-1 gap-1.5 bg-bg-1/80 text-[11px] px-3 py-1.5 backdrop-blur-md hover:bg-bg-1"
                        >
                          <Eye className="size-3.5" aria-hidden />
                          Reveal Image
                        </Button>
                      </div>
                    )}

                    {/* Reveal toggle button when already revealed */}
                    {isRevealed && isFlagged && (
                      <button
                        type="button"
                        onClick={() => toggleReveal(file.id)}
                        className="absolute right-2 top-2 rounded-lg bg-bg-1/80 p-1.5 text-ink-muted backdrop-blur-md hover:text-ink"
                        title="Hide image"
                      >
                        <EyeOff className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="flex flex-1 flex-col justify-between p-4 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-medium text-ink" title={file.originalName}>
                          {file.originalName}
                        </span>
                        {file.moderation?.status === "FLAGGED_ADULT" && (
                          <Badge className="border-danger/40 bg-danger/10 text-danger shrink-0 text-[10px]">
                            Adult NSFW
                          </Badge>
                        )}
                        {file.moderation?.status === "FLAGGED_SUGGESTIVE" && (
                          <Badge className="border-warning/40 bg-warning/10 text-warning shrink-0 text-[10px]">
                            Suggestive
                          </Badge>
                        )}
                        {file.moderation?.status === "SAFE" && (
                          <Badge className="border-accent/40 bg-accent/10 text-accent-2 shrink-0 text-[10px]">
                            Safe
                          </Badge>
                        )}
                        {(!file.moderation || file.moderation.status === "UNSCANNED") && (
                          <Badge className="border-border text-ink-faint shrink-0 text-[10px]">
                            Unscanned
                          </Badge>
                        )}
                        {file.moderation?.status === "ERROR" && (
                          <Badge className="border-danger/30 text-danger shrink-0 text-[10px]">
                            Scan Error
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-faint">
                        <span>{formatBytes(file.size)}</span>
                        <span>·</span>
                        <span>
                          {file.userName ?? file.userEmail ?? (file.anonymousSessionId ? "Anonymous" : "Unknown")}
                        </span>
                        <span>·</span>
                        <span>{formatRelativeDate(file.createdAt)}</span>
                      </div>

                      {file.moderation?.reason && (
                        <p className="mt-1 rounded-lg border border-border/50 bg-bg-3/50 p-2 text-xs text-ink-muted leading-relaxed">
                          <span className="font-semibold text-ink-faint uppercase text-[10px] block">
                            AI Verdict ({Math.round((file.moderation.confidence ?? 0.8) * 100)}% confidence):
                          </span>
                          {file.moderation.reason}
                        </p>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-3">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isScanning}
                        onClick={() => handleSingleScan(file.id)}
                        className="gap-1.5 text-xs text-ink-muted hover:text-ink px-2.5 py-1"
                        title="Re-scan with Vision AI"
                      >
                        {isScanning ? (
                          <Loader2 className="size-3 animate-spin" aria-hidden />
                        ) : (
                          <RotateCw className="size-3" aria-hidden />
                        )}
                        Scan
                      </Button>

                      <div className="flex items-center gap-1.5">
                        {isFlagged && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleMarkSafe(file.id)}
                            className="gap-1 text-xs text-accent-2 hover:bg-accent/10 px-2.5 py-1"
                            title="Mark as false positive safe"
                          >
                            <CheckCircle className="size-3" aria-hidden />
                            Safe
                          </Button>
                        )}

                        <a
                          href={`/api/backstage/files/${file.id}/download`}
                          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink px-2.5 py-1 rounded-lg border border-border bg-bg-3"
                          title="Download file"
                        >
                          <Download className="size-3" aria-hidden />
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <ShieldCheck className="size-10 text-ink-faint" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-ink">No images match this filter</p>
            <p className="text-xs text-ink-faint">
              Try switching tabs or scan pending images to populate the moderation feed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
