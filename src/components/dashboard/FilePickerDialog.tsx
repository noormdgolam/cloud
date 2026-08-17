"use client";

import { useEffect, useState } from "react";
import { Check, Search, UploadCloud } from "lucide-react";
import { listFilesForPicker, type PickerFile } from "@/lib/actions/file-actions";
import { uploadFile } from "@/lib/client-upload";
import { formatBytes } from "@/lib/format";
import { mimeIcon } from "@/lib/mime-icon";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

/**
 * Generic "pick a file from your storage" dialog, filtered by whatever the
 * caller's tool accepts. Also lets the user upload a fresh local file on the
 * spot rather than dead-ending them if the file they want isn't in the cloud
 * yet — the whole reason this page exists is to make tools reachable without
 * first hunting a file down in the browser.
 *
 * No reset-on-close effect here on purpose — the caller renders this keyed
 * by the active tool id, so switching tools remounts it and clears state for
 * free instead of needing a setState-in-effect.
 */
export function FilePickerDialog({
  title,
  accept,
  multiple = false,
  minSelected = 1,
  open,
  onOpenChange,
  onSelect,
}: {
  title: string;
  accept: (mimeType: string) => boolean;
  multiple?: boolean;
  minSelected?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (files: PickerFile[]) => void;
}) {
  const [files, setFiles] = useState<PickerFile[] | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = open && files === undefined;

  useEffect(() => {
    if (!open || files !== undefined) return;
    let cancelled = false;
    listFilesForPicker().then((result) => {
      if (!cancelled) setFiles(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open, files]);

  const matching = (files ?? []).filter(
    (f) => accept(f.mimeType) && (query.trim() === "" || f.name.toLowerCase().includes(query.trim().toLowerCase()))
  );

  function pick(file: PickerFile) {
    if (!multiple) {
      onSelect([file]);
      onOpenChange(false);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(file.id)) next.delete(file.id);
      else next.add(file.id);
      return next;
    });
  }

  async function handleLocalUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const localFile = e.target.files?.[0];
    e.target.value = "";
    if (!localFile) return;
    if (!accept(localFile.type)) {
      setError("That file type isn't supported by this tool.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadFile(localFile, null, () => {});
      const refreshed = await listFilesForPicker();
      setFiles(refreshed);
      const uploaded = refreshed.find((f) => f.name === localFile.name);
      if (uploaded && !multiple) {
        onSelect([uploaded]);
        onOpenChange(false);
      }
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} className="flex max-h-[75dvh] flex-col p-4">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-2 px-3 py-2">
          <Search className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your files…"
            className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>

        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong px-3 py-3 text-sm text-ink-muted transition-colors hover:border-accent/50 hover:text-ink">
          <UploadCloud className="size-4" aria-hidden />
          {uploading ? "Uploading…" : "Or upload a new file"}
          <input type="file" className="hidden" onChange={handleLocalUpload} disabled={uploading} />
        </label>

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}

        <div className="mt-3 flex flex-col gap-0.5 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-ink-faint">Loading files…</p>
          ) : matching.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">No matching files. Upload one above.</p>
          ) : (
            matching.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => pick(file)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-[var(--glass-surface-hover)]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-2">
                  {selected.has(file.id) ? (
                    <Check className="size-4 text-accent" aria-hidden />
                  ) : (
                    mimeIcon(file.mimeType, "size-3.5 text-ink-muted")
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
                <span className="shrink-0 font-mono text-xs text-ink-faint">{formatBytes(file.size)}</span>
              </button>
            ))
          )}
        </div>

        {multiple && (
          <Button
            type="button"
            variant="accent"
            className="mt-3 w-full"
            disabled={selected.size < minSelected}
            onClick={() => {
              const picked = (files ?? []).filter((f) => selected.has(f.id));
              onSelect(picked);
              onOpenChange(false);
            }}
          >
            {selected.size < minSelected
              ? `Select at least ${minSelected}`
              : `Use ${selected.size} file${selected.size === 1 ? "" : "s"}`}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
