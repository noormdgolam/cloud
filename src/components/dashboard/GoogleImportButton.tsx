"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, FileSymlink, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { pickFromDrive, type SkippedDriveFile } from "@/lib/google-import/drive-picker";
import { startPhotosPicker, openPhotosPickerManually, waitForPhotosSelection, PhotosPickerCancelled } from "@/lib/google-import/photos-picker";

type Status =
  | { state: "idle" }
  | { state: "picking-drive" }
  | { state: "photos-needs-open"; pickerUri: string }
  | { state: "waiting-photos" }
  | { state: "error"; message: string }
  | { state: "skipped"; items: SkippedDriveFile[] };

export function GoogleImportButton({ onFilesReady }: { onFilesReady: (files: File[]) => void }) {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  async function handleDrive() {
    setStatus({ state: "picking-drive" });
    try {
      const { files, skipped } = await pickFromDrive();
      if (files.length > 0) onFilesReady(files);
      setStatus(skipped.length > 0 ? { state: "skipped", items: skipped } : { state: "idle" });
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "Couldn't import from Drive." });
    }
  }

  async function handlePhotos() {
    setStatus({ state: "waiting-photos" });
    try {
      const { sessionId, token, pickerUri, windowOpened } = await startPhotosPicker();

      const controller = new AbortController();
      abortRef.current = controller;
      // windowOpened=false means the browser blocked it (real async time —
      // the OAuth token request itself — passed since the click, so this
      // open no longer counts as a trusted gesture). Polling doesn't need
      // the window, only the session, so it starts either way; the fallback
      // button just gives the user a way to actually reach the picker.
      if (!windowOpened) setStatus({ state: "photos-needs-open", pickerUri });

      const { files, skipped } = await waitForPhotosSelection(sessionId, token, { signal: controller.signal });
      if (files.length > 0) onFilesReady(files);
      setStatus(skipped.length > 0 ? { state: "skipped", items: skipped } : { state: "idle" });
    } catch (error) {
      if (error instanceof PhotosPickerCancelled) {
        setStatus({ state: "idle" });
        return;
      }
      setStatus({ state: "error", message: error instanceof Error ? error.message : "Couldn't import from Google Photos." });
    }
  }

  function cancelPhotosWait() {
    abortRef.current?.abort();
    setStatus({ state: "idle" });
  }

  const busy = status.state === "picking-drive" || status.state === "waiting-photos" || status.state === "photos-needs-open";

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        className="px-4 py-2 text-sm"
        disabled={busy}
        onClick={handleDrive}
      >
        <FileSymlink className="size-4" aria-hidden />
        {status.state === "picking-drive" ? "Opening Drive…" : "From Drive"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="px-4 py-2 text-sm"
        disabled={busy}
        onClick={handlePhotos}
      >
        <ImageIcon className="size-4" aria-hidden />
        {status.state === "waiting-photos" || status.state === "photos-needs-open" ? "Waiting for Photos…" : "From Photos"}
      </Button>

      {status.state === "waiting-photos" && (
        <div className="absolute right-0 top-full z-20 mt-1.5 flex w-64 items-center justify-between gap-2 rounded-xl border border-border bg-bg-1 p-3 text-xs text-ink-muted shadow-lg">
          <span>Pick your photos in the window that opened, then come back here.</span>
          <button type="button" onClick={cancelPhotosWait} className="shrink-0 rounded-lg p-1 hover:bg-[var(--glass-surface-hover)] hover:text-ink" aria-label="Cancel">
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}

      {status.state === "photos-needs-open" && (
        <div className="absolute right-0 top-full z-20 mt-1.5 flex w-64 flex-col gap-2 rounded-xl border border-border bg-bg-1 p-3 text-xs text-ink-muted shadow-lg">
          <span>Your browser blocked the popup — open it manually instead:</span>
          <Button
            type="button"
            variant="accent"
            className="px-3 py-1.5 text-xs"
            onClick={() => {
              openPhotosPickerManually(status.pickerUri);
              setStatus({ state: "waiting-photos" });
            }}
          >
            Open Google Photos
          </Button>
          <button type="button" onClick={cancelPhotosWait} className="self-start text-ink-faint hover:text-ink">
            Cancel
          </button>
        </div>
      )}

      {status.state === "error" && (
        <div className={cn("absolute right-0 top-full z-20 mt-1.5 w-64 rounded-xl border border-danger/40 bg-bg-1 p-3 text-xs text-danger shadow-lg")}>
          {status.message}
          <button type="button" onClick={() => setStatus({ state: "idle" })} className="mt-2 block text-ink-faint hover:text-ink">
            Dismiss
          </button>
        </div>
      )}

      {status.state === "skipped" && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-72 rounded-xl border border-warning/40 bg-bg-1 p-3 text-xs text-ink-muted shadow-lg">
          <p className="mb-1.5 font-medium text-ink">
            {status.items.length} item{status.items.length === 1 ? "" : "s"} skipped
          </p>
          <ul className="flex flex-col gap-1">
            {status.items.map((item, i) => (
              <li key={i}>
                <span className="text-ink">{item.name}</span> — {item.reason}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setStatus({ state: "idle" })} className="mt-2 text-ink-faint hover:text-ink">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
