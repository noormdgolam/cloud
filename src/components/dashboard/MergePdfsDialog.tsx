"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { uploadFile } from "@/lib/client-upload";
import { mergePdfs } from "@/lib/pdf-tools";

export function MergePdfsDialog({
  fileIds,
  folderId,
  open,
  onOpenChange,
  onDone,
}: {
  fileIds: string[];
  folderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("Merged");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMerge() {
    setBusy(true);
    setError(null);
    try {
      const buffers = await Promise.all(
        fileIds.map((id) => fetch(`/api/files/${id}/download?inline=1`).then((res) => res.arrayBuffer()))
      );
      const merged = await mergePdfs(buffers);
      const file = new File([new Uint8Array(merged)], `${name || "Merged"}.pdf`, { type: "application/pdf" });
      await uploadFile(file, folderId, () => {});
      onOpenChange(false);
      onDone();
    } catch {
      setError("Couldn't merge these PDFs. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Merge ${fileIds.length} PDFs`} description="Files are combined in the order they're currently listed.">
        <div className="flex flex-col gap-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Merged file name" autoFocus />
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="button" variant="accent" className="w-full" disabled={busy} onClick={handleMerge}>
            {busy ? "Merging…" : "Merge"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
