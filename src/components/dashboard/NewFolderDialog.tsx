"use client";

import { useRef, useState } from "react";
import { FolderPlus } from "lucide-react";
import { createFolder } from "@/lib/actions/folder-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";

export function NewFolderDialog({ parentId }: { parentId: string | null }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const action = createFolder.bind(null, parentId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="px-4 py-2 text-sm">
          <FolderPlus className="size-4" aria-hidden />
          New folder
        </Button>
      </DialogTrigger>
      <DialogContent title="New folder">
        <form
          ref={formRef}
          action={async (formData) => {
            await action(formData);
            setOpen(false);
            formRef.current?.reset();
          }}
          className="flex flex-col gap-4"
        >
          <Input name="name" placeholder="Untitled folder" autoFocus required maxLength={120} />
          <Button type="submit" variant="accent" className="w-full">
            Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
