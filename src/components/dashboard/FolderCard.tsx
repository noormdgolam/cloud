"use client";

import { useState } from "react";
import Link from "next/link";
import { Folder as FolderIcon, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteFolder, renameFolder } from "@/lib/actions/folder-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function FolderCard({ id, name }: { id: string; name: string }) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const renameAction = renameFolder.bind(null, id);

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border bg-bg-2 px-3.5 py-3 transition-colors hover:border-border-strong">
      <Link href={`/folder/${id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-1">
          <FolderIcon className="size-4 text-accent-2" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="truncate text-sm text-ink">{name}</span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="rounded-lg p-1.5 text-ink-faint opacity-0 transition-opacity hover:bg-[var(--glass-surface-hover)] hover:text-ink group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label={`Options for ${name}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            <Pencil className="size-3.5" aria-hidden />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
            <Trash2 className="size-3.5" aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent title="Rename folder">
          <form
            action={async (formData) => {
              await renameAction(formData);
              setRenameOpen(false);
            }}
            className="flex flex-col gap-4"
          >
            <Input name="name" defaultValue={name} autoFocus required maxLength={120} />
            <Button type="submit" variant="accent" className="w-full">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          title={`Delete "${name}"?`}
          description="Files inside will move to your root folder — nothing gets deleted."
        >
          <form
            action={async () => {
              await deleteFolder(id);
              setDeleteOpen(false);
            }}
          >
            <Button type="submit" variant="ghost" className="w-full border-danger/40 text-danger hover:border-danger">
              Delete folder
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
