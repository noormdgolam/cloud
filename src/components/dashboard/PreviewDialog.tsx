"use client";

import { Download } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { LinkButton } from "@/components/ui/Button";
import { previewKind } from "@/lib/mime-preview";
import { TextPreview } from "./TextPreview";
import { OfficePreview } from "./OfficePreview";

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
  const kind = previewKind(mimeType);
  const inlineUrl = `/api/files/${fileId}/download?inline=1`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={fileName}
        className="fixed left-0 top-0 flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 flex-col rounded-none p-4 sm:p-6"
      >
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl bg-bg-2">
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-uploaded content, not a build-time-known asset
            <img src={inlineUrl} alt={fileName} className="max-h-[65dvh] w-auto max-w-full object-contain" />
          ) : kind === "video" ? (
            <video src={inlineUrl} controls className="max-h-[65dvh] w-full" />
          ) : kind === "audio" ? (
            <div className="flex w-full flex-col items-center gap-4 p-8">
              <span className="text-sm text-ink-muted">{fileName}</span>
              <audio src={inlineUrl} controls className="w-full max-w-md" />
            </div>
          ) : kind === "text" ? (
            <TextPreview url={inlineUrl} />
          ) : kind === "docx" || kind === "xlsx" ? (
            <OfficePreview url={inlineUrl} kind={kind} />
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
