"use client";

import { useState } from "react";
import { FolderOpen, Home } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { createFileRequest } from "@/lib/actions/file-request-actions";
import { FolderPickerDialog } from "./FolderPickerDialog";

export function CreateFileRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    if (folderId) formData.set("folderId", folderId);
    try {
      await createFileRequest(formData);
      onOpenChange(false);
      setFolderId(null);
      setFolderName(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New file request" description="Generate a link that lets anyone drop files into your storage — no account needed on their end.">
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="e.g. Wedding photos from the team" required maxLength={191} autoFocus />
          </div>
          <div>
            <Label htmlFor="message">Message (optional)</Label>
            <Input id="message" name="message" placeholder="A note shown to whoever opens the link" maxLength={500} />
          </div>

          <div>
            <Label>Destination folder</Label>
            <button
              type="button"
              onClick={() => setFolderPickerOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-bg-2 px-3 py-2.5 text-left text-sm text-ink hover:border-border-strong"
            >
              {folderId ? (
                <FolderOpen className="size-4 text-accent-2" strokeWidth={1.75} aria-hidden />
              ) : (
                <Home className="size-4 text-ink-muted" strokeWidth={1.75} aria-hidden />
              )}
              {folderName ?? "Root"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="maxFiles">Max files (optional)</Label>
              <Input id="maxFiles" name="maxFiles" type="number" min={1} max={500} placeholder="Unlimited" />
            </div>
            <div>
              <Label htmlFor="expiresInDays">Expires in (days)</Label>
              <Input id="expiresInDays" name="expiresInDays" type="number" min={1} max={365} placeholder="Never" />
            </div>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <Button type="submit" variant="accent" className="w-full" disabled={saving}>
            {saving ? "Creating…" : "Create request link"}
          </Button>
        </form>
      </DialogContent>

      <FolderPickerDialog
        title="Choose a destination folder"
        currentFolderId={folderId}
        open={folderPickerOpen}
        onOpenChange={setFolderPickerOpen}
        onSelect={(id, name) => {
          setFolderId(id);
          setFolderName(id ? (name ?? null) : null);
        }}
      />
    </Dialog>
  );
}
