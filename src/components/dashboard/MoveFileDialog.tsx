"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Home } from "lucide-react";
import { listUserFolders, moveFile } from "@/lib/actions/file-actions";
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

export function MoveFileDialog({
  fileId,
  currentFolderId,
  open,
  onOpenChange,
}: {
  fileId: string;
  currentFolderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // undefined = not fetched yet for this time the dialog was opened.
  const [folders, setFolders] = useState<FolderEntry[] | undefined>(undefined);
  const [moving, setMoving] = useState(false);
  const loading = open && folders === undefined;

  useEffect(() => {
    if (!open || folders !== undefined) return;
    let cancelled = false;
    listUserFolders().then((result) => {
      if (!cancelled) setFolders(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open, folders]);

  const byId = new Map((folders ?? []).map((f) => [f.id, f]));

  async function handleMove(targetFolderId: string | null) {
    setMoving(true);
    await moveFile(fileId, targetFolderId);
    setMoving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Move to..." className="flex max-h-[70vh] flex-col p-4">
        {loading ? (
          <p className="py-6 text-center text-sm text-ink-faint">Loading folders…</p>
        ) : (
          <div className="flex flex-col gap-0.5 overflow-y-auto">
            <button
              type="button"
              disabled={moving || currentFolderId === null}
              onClick={() => handleMove(null)}
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
                onClick={() => handleMove(folder.id)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-ink hover:bg-[var(--glass-surface-hover)] disabled:opacity-40"
              >
                <FolderOpen className="size-4 text-accent-2" strokeWidth={1.75} aria-hidden />
                {folderPath(folder, byId)}
              </button>
            ))}
            {folders?.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-faint">No other folders yet.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
