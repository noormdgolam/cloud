"use client";

import { useState } from "react";
import { MoreHorizontal, Download, Pencil, Trash2, Share2, FolderInput } from "lucide-react";
import { formatBytes, formatRelativeDate } from "@/lib/format";
import { mimeIcon } from "@/lib/mime-icon";
import { deleteFile, renameFile } from "@/lib/actions/file-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ShareDialog } from "./ShareDialog";
import { MoveFileDialog } from "./MoveFileDialog";

function triggerDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function FileRow({
  id,
  name,
  size,
  mimeType,
  createdAt,
  folderId = null,
}: {
  id: string;
  name: string;
  size: bigint;
  mimeType: string;
  createdAt: Date;
  folderId?: string | null;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const renameAction = renameFile.bind(null, id);

  return (
    <div className="group flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors hover:bg-[var(--glass-surface-hover)]">
      <a
        href={`/api/files/${id}/download`}
        className="flex min-w-0 flex-1 items-center gap-3"
        title={`Download ${name}`}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-2">
          {mimeIcon(mimeType, "size-4 text-ink-muted")}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{name}</span>
      </a>
      <span className="hidden font-mono text-xs text-ink-faint sm:block">
        {formatRelativeDate(createdAt)}
      </span>
      <span className="font-mono text-xs text-ink-faint">{formatBytes(size)}</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="rounded-lg p-1.5 text-ink-faint transition-opacity hover:bg-[var(--glass-surface-hover)] hover:text-ink md:opacity-0 md:group-hover:opacity-100 md:data-[state=open]:opacity-100"
            aria-label={`Options for ${name}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => triggerDownload(`/api/files/${id}/download`)}>
            <Download className="size-3.5" aria-hidden />
            Download
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShareOpen(true)}>
            <Share2 className="size-3.5" aria-hidden />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            <Pencil className="size-3.5" aria-hidden />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMoveOpen(true)}>
            <FolderInput className="size-3.5" aria-hidden />
            Move to...
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
            <Trash2 className="size-3.5" aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareDialog fileId={id} fileName={name} open={shareOpen} onOpenChange={setShareOpen} />
      <MoveFileDialog fileId={id} currentFolderId={folderId} open={moveOpen} onOpenChange={setMoveOpen} />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent title="Rename file">
          <form
            action={async (formData) => {
              await renameAction(formData);
              setRenameOpen(false);
            }}
            className="flex flex-col gap-4"
          >
            <Input name="name" defaultValue={name} autoFocus required maxLength={255} />
            <Button type="submit" variant="accent" className="w-full">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent title={`Delete "${name}"?`} description="This can't be undone.">
          <form
            action={async () => {
              await deleteFile(id);
              setDeleteOpen(false);
            }}
          >
            <Button
              type="submit"
              variant="ghost"
              className="w-full border-danger/40 text-danger hover:border-danger"
            >
              Delete file
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
