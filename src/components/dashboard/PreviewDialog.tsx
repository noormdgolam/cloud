"use client";

import { Download } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { LinkButton } from "@/components/ui/Button";

export function PreviewDialog({
  fileId,
  fileName,
  mimeType,
  open,
  onOpenChange,
}: {
  fileId: string;
  fileName: string;
  mimeType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isImage = mimeType.startsWith("image/");
  const inlineUrl = `/api/files/${fileId}/download?inline=1`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={fileName}
        className="flex max-h-[85vh] w-[calc(100%-2rem)] max-w-3xl flex-col p-4"
      >
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl bg-bg-2">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-uploaded content, not a build-time-known asset
            <img src={inlineUrl} alt={fileName} className="max-h-[65vh] w-auto max-w-full object-contain" />
          ) : (
            <iframe src={inlineUrl} title={fileName} className="h-[65vh] w-full rounded-xl" />
          )}
        </div>
        <LinkButton
          href={`/api/files/${fileId}/download`}
          variant="ghost"
          className="mt-4 w-full px-4 py-2 text-sm"
        >
          <Download className="size-4" aria-hidden />
          Download
        </LinkButton>
      </DialogContent>
    </Dialog>
  );
}
