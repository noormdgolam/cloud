"use client";

import { useState } from "react";
import {
  Download,
  Image as ImageIcon,
  Video,
  Play,
  X,
  Folder,
} from "lucide-react";
import { formatBytes, formatRelativeDate } from "@/lib/format";
import { mimeIcon } from "@/lib/mime-icon";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

export type VaultMediaItem = {
  id: string;
  originalName: string;
  size: bigint;
  mimeType: string;
  status: "COMMITTED" | "DELETED" | "PURGED";
  createdAt: Date;
  folderName: string | null;
  checksumSha256: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
};

export function VaultGalleryClient({
  files,
}: {
  files: VaultMediaItem[];
}) {
  const [search, setSearch] = useState("");
  const [mediaType, setMediaType] = useState<"all" | "photos" | "videos" | "other">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "COMMITTED" | "DELETED" | "PURGED">("all");
  const [previewItem, setPreviewItem] = useState<VaultMediaItem | null>(null);

  const filtered = files.filter((f) => {
    const isPhoto = f.mimeType.startsWith("image/");
    const isVideo = f.mimeType.startsWith("video/");

    if (mediaType === "photos" && !isPhoto) return false;
    if (mediaType === "videos" && !isVideo) return false;
    if (mediaType === "other" && (isPhoto || isVideo)) return false;

    if (statusFilter !== "all" && f.status !== statusFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = f.originalName.toLowerCase().includes(q);
      const matchEmail = (f.userEmail ?? "").toLowerCase().includes(q);
      const matchFolder = (f.folderName ?? "").toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchFolder) return false;
    }

    return true;
  });

  const photoCount = files.filter((f) => f.mimeType.startsWith("image/")).length;
  const videoCount = files.filter((f) => f.mimeType.startsWith("video/")).length;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Filters & Search ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-bg-2/50 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMediaType("all")}
            className={`rounded-xl px-3 py-1.5 transition-colors ${
              mediaType === "all"
                ? "bg-accent text-white"
                : "text-ink-muted hover:text-ink hover:bg-bg-3"
            }`}
          >
            All Files ({files.length})
          </button>
          <button
            type="button"
            onClick={() => setMediaType("photos")}
            className={`rounded-xl px-3 py-1.5 transition-colors flex items-center gap-1.5 ${
              mediaType === "photos"
                ? "bg-accent text-white"
                : "text-ink-muted hover:text-ink hover:bg-bg-3"
            }`}
          >
            <ImageIcon className="size-3.5" aria-hidden />
            Photos ({photoCount})
          </button>
          <button
            type="button"
            onClick={() => setMediaType("videos")}
            className={`rounded-xl px-3 py-1.5 transition-colors flex items-center gap-1.5 ${
              mediaType === "videos"
                ? "bg-accent text-white"
                : "text-ink-muted hover:text-ink hover:bg-bg-3"
            }`}
          >
            <Video className="size-3.5" aria-hidden />
            Videos ({videoCount})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-xl border border-border bg-bg-3 px-3 py-1.5 text-xs text-ink focus:outline-none"
            aria-label="Filter by file status"
          >
            <option value="all">All File Statuses</option>
            <option value="COMMITTED">Active Files Only</option>
            <option value="DELETED">Trashed by User</option>
            <option value="PURGED">Purged (Permanently Deleted by User)</option>
          </select>

          <div className="relative w-full max-w-xs sm:w-48">
            <Input
              type="search"
              placeholder="Search filename…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs py-1.5"
            />
          </div>
        </div>
      </div>

      {/* ── Gallery View ── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((file) => {
            const isPhoto = file.mimeType.startsWith("image/");
            const isVideo = file.mimeType.startsWith("video/");

            return (
              <div
                key={file.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-bg-2/70 transition-all hover:border-border-hover hover:bg-bg-2"
              >
                {/* Media Preview Box */}
                <div
                  onClick={() => setPreviewItem(file)}
                  className="relative aspect-video w-full cursor-pointer overflow-hidden bg-bg-3"
                >
                  {isPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/backstage/files/${file.id}/download?inline=1`}
                      alt={file.originalName}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  )}

                  {isVideo && (
                    <div className="flex size-full items-center justify-center bg-black/40 text-white">
                      <video
                        src={`/api/backstage/files/${file.id}/download?inline=1`}
                        className="size-full object-cover opacity-80"
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="flex size-10 items-center justify-center rounded-full bg-accent/90 text-white shadow-lg backdrop-blur-sm">
                          <Play className="size-5 ml-0.5" fill="currentColor" aria-hidden />
                        </span>
                      </div>
                    </div>
                  )}

                  {!isPhoto && !isVideo && (
                    <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-ink-muted">
                      {mimeIcon(file.mimeType, "size-10 text-ink-faint")}
                      <span className="text-[11px] font-mono text-ink-faint">{file.mimeType}</span>
                    </div>
                  )}

                  {/* Status Indicator Chip */}
                  <div className="absolute left-2 top-2">
                    {file.status === "COMMITTED" && (
                      <Badge className="border-accent/40 bg-bg-1/80 text-accent-2 backdrop-blur-md text-[10px]">
                        Active
                      </Badge>
                    )}
                    {file.status === "DELETED" && (
                      <Badge className="border-warning/40 bg-bg-1/80 text-warning backdrop-blur-md text-[10px]">
                        Trashed
                      </Badge>
                    )}
                    {file.status === "PURGED" && (
                      <Badge className="border-danger/40 bg-bg-1/80 text-danger backdrop-blur-md text-[10px]">
                        Purged
                      </Badge>
                    )}
                  </div>
                </div>

                {/* File Metadata & Actions */}
                <div className="flex flex-1 flex-col justify-between p-3.5 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <span
                      onClick={() => setPreviewItem(file)}
                      className="cursor-pointer truncate text-sm font-medium text-ink hover:text-accent-2 transition-colors"
                      title={file.originalName}
                    >
                      {file.originalName}
                    </span>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-faint">
                      <span>{formatBytes(file.size)}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Folder className="size-3" aria-hidden />
                        {file.folderName ?? "Root"}
                      </span>
                      <span>·</span>
                      <span>{formatRelativeDate(file.createdAt)}</span>
                    </div>

                    {file.userName && (
                      <p className="text-[11px] text-ink-muted truncate">
                        Owner: <span className="text-ink">{file.userName}</span> ({file.userEmail})
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewItem(file)}
                      className="text-xs text-accent-2 hover:underline"
                      data-mcp-action="preview-media"
                    >
                      Inspect
                    </button>

                    <a
                      href={`/api/backstage/files/${file.id}/download`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg-3 px-2.5 py-1 text-xs text-ink hover:bg-bg-1 transition-colors"
                      title={`Download ${file.originalName}`}
                      data-mcp-action="download-vault-file"
                    >
                      <Download className="size-3" aria-hidden />
                      Download
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <ImageIcon className="size-10 text-ink-faint" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-ink">No media found</p>
            <p className="text-xs text-ink-faint">
              Try adjusting your search or media type filters above.
            </p>
          </div>
        </div>
      )}

      {/* ── Fullscreen Media Inspection Lightbox Modal ── */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-bg-1 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-bg-2 border border-border">
                  {mimeIcon(previewItem.mimeType, "size-4 text-ink")}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-ink" title={previewItem.originalName}>
                    {previewItem.originalName}
                  </h2>
                  <p className="text-xs text-ink-faint">
                    {formatBytes(previewItem.size)} · {previewItem.mimeType} · {formatRelativeDate(previewItem.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/backstage/files/${previewItem.id}/download`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-medium text-white hover:brightness-110"
                >
                  <Download className="size-3.5" aria-hidden />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="rounded-xl p-2 text-ink-muted hover:bg-bg-2 hover:text-ink"
                  aria-label="Close modal"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            {/* Modal Body: Media Preview */}
            <div className="flex flex-1 items-center justify-center overflow-auto bg-bg-3 p-4 min-h-[300px] max-h-[60dvh]">
              {previewItem.mimeType.startsWith("image/") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/backstage/files/${previewItem.id}/download?inline=1`}
                  alt={previewItem.originalName}
                  className="max-h-[55dvh] max-w-full rounded-xl object-contain shadow-lg"
                />
              )}

              {previewItem.mimeType.startsWith("video/") && (
                <video
                  src={`/api/backstage/files/${previewItem.id}/download?inline=1`}
                  controls
                  autoPlay
                  className="max-h-[55dvh] max-w-full rounded-xl shadow-lg"
                />
              )}

              {!previewItem.mimeType.startsWith("image/") && !previewItem.mimeType.startsWith("video/") && (
                <div className="flex flex-col items-center gap-3 text-center p-8">
                  {mimeIcon(previewItem.mimeType, "size-16 text-ink-faint")}
                  <p className="text-sm font-medium text-ink">{previewItem.originalName}</p>
                  <p className="text-xs text-ink-faint font-mono">
                    SHA256: {previewItem.checksumSha256 ?? "N/A"}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer: Detailed Immutable Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border bg-bg-2/70 p-4 text-xs">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-ink-faint block">Owner</span>
                <span className="font-medium text-ink truncate block">
                  {previewItem.userName ?? "Anonymous"}
                </span>
                <span className="text-ink-faint text-[11px] truncate block">{previewItem.userEmail}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-ink-faint block">Vault Status</span>
                <span className="font-medium text-ink block">{previewItem.status}</span>
                <span className="text-ink-faint text-[11px] block">Immutable / Permanent</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-ink-faint block">Folder Path</span>
                <span className="font-medium text-ink block">{previewItem.folderName ?? "Root"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-ink-faint block">File ID</span>
                <span className="font-mono text-ink-muted text-[11px] truncate block">{previewItem.id}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
