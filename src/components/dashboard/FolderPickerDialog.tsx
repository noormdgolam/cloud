"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Home } from "lucide-react";
import { listUserFolders } from "@/lib/actions/file-actions";
import { listUserFoldersForMove } from "@/lib/actions/folder-actions";
import { Dialog, DialogContent } from "@/components/ui/Dialog";

type FolderEntry = { id: string; name: string; parentId: string | null };

function folderPath(folder: FolderEntry, byId: Map<string, FolderEntry>): string {
  const parts = [folder.name];
  let cursor = folder.parentId;
  while (cursor) {
    const parent = byId.get(cursor);
    if (!parent) break;
    parts.unshift(parent.name);
    cursor = parent.parentId;
  }
  return parts.join(" / ");
}

/**
 * Pure folder picker — the caller decides what "picking a folder" does
 * (move one file, move a whole selection, move a folder...). Shared by
 * MoveFileDialog (single file), MoveFolderDialog (folders), and SelectableFileList's bulk move.
 */
export function FolderPickerDialog({
  title = "Move to...",
  currentFolderId,
  open,
  onOpenChange,
  onSelect,
  folderIdForMove,
  emptyText,
}: {
  title?: string;
  currentFolderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (targetFolderId: string | null, folderName?: string) => void | Promise<void>;
  folderIdForMove?: string;
  emptyText?: string;
}) {
  // undefined = not fetched yet for this time the dialog was opened.
  const [folders, setFolders] = useState<FolderEntry[] | undefined>(undefined);
  const [moving, setMoving] = useState(false);
  const loading = open && folders === undefined;

  useEffect(() => {
    if (!open || folders !== undefined) return;
    let cancelled = false;
    const fetcher = folderIdForMove ? listUserFoldersForMove(folderIdForMove) : listUserFolders();
    fetcher.then((result) => {
      if (!cancelled) setFolders(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open, folders, folderIdForMove]);

  const byId = new Map((folders ?? []).map((f) => [f.id, f]));

  async function handlePick(targetFolderId: string | null, folderName?: string) {
    setMoving(true);
    await onSelect(targetFolderId, folderName);
    setMoving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} className="flex max-h-[70dvh] flex-col p-4">
        {loading ? (
          <p className="py-6 text-center text-sm text-ink-faint">Loading folders…</p>
        ) : (
          <div className="flex flex-col gap-0.5 overflow-y-auto">
            <button
              type="button"
              disabled={moving || currentFolderId === null}
              onClick={() => handlePick(null)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-ink hover:bg-[var(--glass-surface-hover)] disabled:opacity-40"
            >
              <Home className="size-4 text-ink-muted" strokeWidth={1.75} aria-hidden />
              Root
            </button>
            {(folders ?? []).map((folder) => (
              <button
                key={folder.id}
                type="button"
                disabled={moving || currentFolderId === folder.id}
                onClick={() => handlePick(folder.id, folderPath(folder, byId))}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-ink hover:bg-[var(--glass-surface-hover)] disabled:opacity-40"
              >
                <FolderOpen className="size-4 text-accent-2" strokeWidth={1.75} aria-hidden />
                {folderPath(folder, byId)}
              </button>
            ))}
            {folders?.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-faint">
                {emptyText ?? (folderIdForMove ? "No other folders to move into." : "No other folders yet.")}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

