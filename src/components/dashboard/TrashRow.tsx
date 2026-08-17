"use client";

import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { formatBytes, formatRelativeDate } from "@/lib/format";
import { mimeIcon } from "@/lib/mime-icon";
import { restoreFile, permanentlyDeleteFile } from "@/lib/actions/file-actions";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";

export function TrashRow({
  id,
  name,
  size,
  mimeType,
  deletedAt,
}: {
  id: string;
  name: string;
  size: bigint;
  mimeType: string;
  deletedAt: Date | null;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState<"restore" | "delete" | null>(null);

  return (
    <div className="flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors hover:bg-[var(--glass-surface-hover)]">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-2">
        {mimeIcon(mimeType, "size-4 text-ink-muted")}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{name}</span>
      <span className="hidden font-mono text-xs text-ink-faint sm:block">
        {deletedAt ? `Deleted ${formatRelativeDate(deletedAt)}` : ""}
      </span>
      <span className="font-mono text-xs text-ink-faint">{formatBytes(size)}</span>

      <button
        type="button"
        disabled={busy !== null}
        onClick={async () => {
          setBusy("restore");
          await restoreFile(id);
          setBusy(null);
        }}
        className="rounded-lg p-1.5 text-ink-faint hover:bg-[var(--glass-surface-hover)] hover:text-ink disabled:opacity-50"
        aria-label={`Restore ${name}`}
        title="Restore"
      >
        <RotateCcw className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="rounded-lg p-1.5 text-ink-faint hover:bg-[var(--glass-surface-hover)] hover:text-danger"
        aria-label={`Delete ${name} forever`}
        title="Delete forever"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent title={`Delete "${name}" forever?`} description="This can't be undone — the file will be permanently removed.">
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== null}
            className="w-full border-danger/40 text-danger hover:border-danger"
            onClick={async () => {
              setBusy("delete");
              await permanentlyDeleteFile(id);
              setBusy(null);
              setDeleteOpen(false);
            }}
          >
            {busy === "delete" ? "Deleting…" : "Delete forever"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
