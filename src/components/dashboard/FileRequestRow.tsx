"use client";

import { useState } from "react";
import { Ban, Check, Copy, Link2, Trash2 } from "lucide-react";
import { formatRelativeDate } from "@/lib/format";
import { revokeFileRequest, deleteFileRequest } from "@/lib/actions/file-request-actions";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import type { FileRequestListItem } from "@/lib/data/file-requests";

export function FileRequestRow({ request }: { request: FileRequestListItem }) {
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const expired = request.expiresAt !== null && request.expiresAt < new Date();
  const full = request.maxFiles !== null && request.fileCount >= request.maxFiles;
  const inactive = request.revoked || expired || full;
  const link = typeof window !== "undefined" ? `${window.location.origin}/request/${request.token}` : `/request/${request.token}`;

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-3 rounded-xl px-3.5 py-3 hover:bg-[var(--glass-surface-hover)]">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-2">
        <Link2 className="size-4 text-ink-muted" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{request.title}</span>
        <span className="block text-xs text-ink-faint">
          {request.fileCount} file{request.fileCount === 1 ? "" : "s"} received
          {request.maxFiles !== null && ` of ${request.maxFiles}`}
          {" · "}
          {request.revoked ? "closed" : expired ? "expired" : full ? "full" : `created ${formatRelativeDate(request.createdAt)}`}
        </span>
      </span>

      <button
        type="button"
        onClick={copyLink}
        disabled={inactive}
        title="Copy link"
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-ink-faint hover:bg-[var(--glass-surface-hover)] hover:text-ink disabled:opacity-40"
      >
        {copied ? <Check className="size-3.5 text-accent" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? "Copied" : "Copy link"}
      </button>

      {!request.revoked && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await revokeFileRequest(request.id);
            setBusy(false);
          }}
          title="Close this request"
          className="rounded-lg p-1.5 text-ink-faint hover:bg-[var(--glass-surface-hover)] hover:text-ink disabled:opacity-40"
        >
          <Ban className="size-4" aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        title="Delete"
        className="rounded-lg p-1.5 text-ink-faint hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          title={`Delete "${request.title}"?`}
          description="Removes the request link. Files already received through it stay in your storage."
        >
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            className="w-full border-danger/40 text-danger hover:border-danger"
            onClick={async () => {
              setBusy(true);
              await deleteFileRequest(request.id);
              setBusy(false);
              setDeleteOpen(false);
            }}
          >
            Delete request
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
