"use client";

import { useEffect, useState } from "react";
import { CheckSquare, Combine, Download, FolderInput, LayoutGrid, List, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FileScanStatus } from "@/lib/data/browser";
import { bulkDeleteFiles, bulkMoveFiles } from "@/lib/actions/file-actions";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { FileRow } from "./FileRow";
import { FileTile } from "./FileTile";
import { FolderPickerDialog } from "./FolderPickerDialog";
import { MergePdfsDialog } from "./MergePdfsDialog";

type FileSummary = {
  id: string;
  originalName: string;
  size: bigint;
  mimeType: string;
  createdAt: Date;
  isDuplicate: boolean;
  scanStatus: FileScanStatus;
};

export function SelectableFileList({ files, parentId }: { files: FileSummary[]; parentId: string | null }) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Server always renders "list" — synced from localStorage in the effect
  // below, matching the ThemeToggle pattern so first render matches the
  // server and there's no hydration mismatch.
  const [gridView, setGridView] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGridView(localStorage.getItem("fileViewMode") === "grid");
  }, []);

  useEffect(() => {
    if (!selectMode) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      // Don't hijack Delete/Escape while the user is typing somewhere
      // (rename dialog, search box, etc.).
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "Escape") {
        exitSelectMode();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        e.preventDefault();
        setBulkDeleteOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectMode, selected]);

  function setViewMode(grid: boolean) {
    setGridView(grid);
    localStorage.setItem("fileViewMode", grid ? "grid" : "list");
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedFiles = files.filter((f) => selected.has(f.id));
  const canMerge = selected.size >= 2 && selectedFiles.every((f) => f.mimeType === "application/pdf");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          className="px-4 py-2 text-xs"
          onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
        >
          <CheckSquare className="size-3.5" aria-hidden />
          {selectMode ? "Cancel" : "Select"}
        </Button>

        <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5">
          <button
            type="button"
            onClick={() => setViewMode(false)}
            aria-label="List view"
            aria-pressed={!gridView}
            className={cn("rounded-full p-1.5", !gridView ? "bg-[var(--glass-surface)] text-ink" : "text-ink-faint")}
          >
            <List className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setViewMode(true)}
            aria-label="Grid view"
            aria-pressed={gridView}
            className={cn("rounded-full p-1.5", gridView ? "bg-[var(--glass-surface)] text-ink" : "text-ink-faint")}
          >
            <LayoutGrid className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {gridView ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((file) => (
            <FileTile
              key={file.id}
              id={file.id}
              name={file.originalName}
              size={file.size}
              mimeType={file.mimeType}
              folderId={parentId}
              isDuplicate={file.isDuplicate}
              scanStatus={file.scanStatus}
              {...(selectMode
                ? { selected: selected.has(file.id), onToggleSelect: () => toggle(file.id) }
                : {})}
            />
          ))}
        </div>
      ) : (
        <div className="glass flex flex-col gap-0.5 rounded-2xl p-2">
          {files.map((file) => (
            <FileRow
              key={file.id}
              id={file.id}
              name={file.originalName}
              size={file.size}
              mimeType={file.mimeType}
              createdAt={file.createdAt}
              folderId={parentId}
              isDuplicate={file.isDuplicate}
              scanStatus={file.scanStatus}
              {...(selectMode
                ? { selected: selected.has(file.id), onToggleSelect: () => toggle(file.id) }
                : {})}
            />
          ))}
        </div>
      )}

      {selectMode && selected.size > 0 && (
        <div className="sticky bottom-4 z-30 flex items-center justify-center">
          <div className="glass flex items-center gap-2 rounded-full px-3 py-2">
            <span className="px-2 text-xs text-ink-muted">{selected.size} selected</span>
            <Button
              type="button"
              variant="ghost"
              className="px-3 py-1.5 text-xs"
              onClick={() => {
                // Single-file selection downloads the file itself; a zip
                // wrapper for exactly one file would just be extra friction.
                const url =
                  selected.size === 1
                    ? `/api/files/${Array.from(selected)[0]}/download`
                    : `/api/files/zip?ids=${Array.from(selected).join(",")}`;
                window.location.href = url;
              }}
            >
              <Download className="size-3.5" aria-hidden />
              Download
            </Button>
            {canMerge && (
              <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setMergeOpen(true)}>
                <Combine className="size-3.5" aria-hidden />
                Merge
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="px-3 py-1.5 text-xs"
              onClick={() => setBulkMoveOpen(true)}
            >
              <FolderInput className="size-3.5" aria-hidden />
              Move
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="border-danger/40 px-3 py-1.5 text-xs text-danger hover:border-danger"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </Button>
            <button
              type="button"
              onClick={exitSelectMode}
              className="rounded-full p-1.5 text-ink-faint hover:bg-[var(--glass-surface-hover)] hover:text-ink"
              aria-label="Cancel selection"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {canMerge && (
        <MergePdfsDialog
          fileIds={Array.from(selected)}
          folderId={parentId}
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          onDone={exitSelectMode}
        />
      )}

      <FolderPickerDialog
        title={`Move ${selected.size} file${selected.size === 1 ? "" : "s"} to...`}
        currentFolderId={parentId}
        open={bulkMoveOpen}
        onOpenChange={setBulkMoveOpen}
        onSelect={async (target) => {
          await bulkMoveFiles(Array.from(selected), target);
          exitSelectMode();
        }}
      />

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent
          title={`Delete ${selected.size} file${selected.size === 1 ? "" : "s"}?`}
          description="Moves to trash — you can restore within 30 days."
        >
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            className="w-full border-danger/40 text-danger hover:border-danger"
            onClick={async () => {
              setBusy(true);
              await bulkDeleteFiles(Array.from(selected));
              setBusy(false);
              setBulkDeleteOpen(false);
              exitSelectMode();
            }}
          >
            {busy ? "Deleting…" : `Delete ${selected.size} file${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
