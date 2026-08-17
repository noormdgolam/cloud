"use client";

import { memo } from "react";
import { Check, MoreHorizontal, Download, Pencil, Trash2, Share2, FolderInput, Wand2, FileOutput, RotateCw, Scissors, Stamp, ShieldOff, Minimize2, Sparkles, AudioLines, Clapperboard, ShieldAlert, Loader2, FileEdit } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FileScanStatus } from "@/lib/data/browser";
import { formatBytes } from "@/lib/format";
import { mimeIcon } from "@/lib/mime-icon";
import { deleteFile } from "@/lib/actions/file-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ShareDialog } from "./ShareDialog";
import { MoveFileDialog } from "./MoveFileDialog";
import { PreviewDialog } from "./PreviewDialog";
import { ImageEditorDialog } from "./ImageEditorDialog";
import { PdfToolDialog } from "./PdfToolDialog";
import { AudioTrimDialog } from "./AudioTrimDialog";
import { PublishReelDialog } from "./PublishReelDialog";
import { VideoTrimDialog } from "./VideoTrimDialog";
import { DocxEditorDialog } from "./DocxEditorDialog";
import { XlsxEditorDialog } from "./XlsxEditorDialog";
import { PdfOcrEditorDialog } from "./PdfOcrEditorDialog";
import { useFileItemActions } from "./useFileItemActions";

export const FileTile = memo(function FileTile({
  id,
  name,
  size,
  mimeType,
  folderId = null,
  isDuplicate = false,
  scanStatus = "SKIPPED",
  selected,
  onToggleSelect,
}: {
  id: string;
  name: string;
  size: bigint;
  mimeType: string;
  folderId?: string | null;
  isDuplicate?: boolean;
  scanStatus?: FileScanStatus;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const {
    renameOpen,
    setRenameOpen,
    deleteOpen,
    setDeleteOpen,
    shareOpen,
    setShareOpen,
    moveOpen,
    setMoveOpen,
    previewOpen,
    setPreviewOpen,
    editorOpen,
    setEditorOpen,
    pdfToolMode,
    setPdfToolMode,
    converting,
    convertError,
    strippingMeta,
    optimizingSvg,
    audioTrimOpen,
    setAudioTrimOpen,
    publishReelOpen,
    setPublishReelOpen,
    videoTrimOpen,
    setVideoTrimOpen,
    docxEditOpen,
    setDocxEditOpen,
    xlsxEditOpen,
    setXlsxEditOpen,
    pdfEditOpen,
    setPdfEditOpen,
    renameAction,
    previewable,
    isImage,
    isPdf,
    isSvg,
    isAudio,
    isVideo,
    isDocx,
    isXlsx,
    conversions,
    isInfected,
    isScanning,
    handleConvert,
    handleStripMetadata,
    handleOptimizeSvg,
    triggerDownload,
  } = useFileItemActions({ id, name, size, mimeType, folderId, scanStatus });

  const selectMode = onToggleSelect !== undefined;


  function open() {
    if (selectMode) onToggleSelect?.();
    else if (isInfected) return;
    else if (previewable) setPreviewOpen(true);
    else triggerDownload(`/api/files/${id}/download`);
  }

  return (
    <div className={cn("group relative flex flex-col overflow-hidden rounded-xl border border-border bg-bg-2", selected && "border-accent", isInfected && "border-danger/40")}>
      <button type="button" onClick={open} className="flex aspect-square w-full items-center justify-center bg-bg-3" title={isInfected ? `${name} — flagged by a malware scan` : name}>
        {isInfected ? (
          <ShieldAlert className="size-8 text-danger" aria-hidden />
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-uploaded content, not a build-time-known asset
          <img
            src={`/api/files/${id}/download?inline=1`}
            alt={name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          mimeIcon(mimeType, "size-8 text-ink-faint")
        )}
      </button>

      {selectMode && (
        <span
          className={cn(
            "absolute left-2 top-2 flex size-6 items-center justify-center rounded-full border",
            selected ? "border-accent bg-accent text-white" : "border-border-strong bg-bg-1/80 text-transparent"
          )}
        >
          {selected && <Check className="size-3.5" aria-hidden />}
        </span>
      )}

      {!selectMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="absolute right-2 top-2 rounded-lg bg-bg-1/80 p-1.5 text-ink-faint opacity-0 backdrop-blur-sm transition-opacity hover:text-ink group-hover:opacity-100 md:data-[state=open]:opacity-100"
              aria-label={`Options for ${name}`}
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {!isInfected && (
              <>
                <DropdownMenuItem onSelect={() => triggerDownload(`/api/files/${id}/download`)}>
                  <Download className="size-3.5" aria-hidden />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShareOpen(true)}>
                  <Share2 className="size-3.5" aria-hidden />
                  Share
                </DropdownMenuItem>
              </>
            )}
            {!isInfected && isImage && (
              <DropdownMenuItem onSelect={() => setEditorOpen(true)}>
                <Wand2 className="size-3.5" aria-hidden />
                Edit image
              </DropdownMenuItem>
            )}
            {!isInfected && isImage && (
              <DropdownMenuItem disabled={strippingMeta} onSelect={handleStripMetadata}>
                <ShieldOff className="size-3.5" aria-hidden />
                {strippingMeta ? "Removing metadata…" : "Remove metadata"}
              </DropdownMenuItem>
            )}
            {!isInfected && isSvg && (
              <DropdownMenuItem disabled={optimizingSvg} onSelect={handleOptimizeSvg}>
                <Sparkles className="size-3.5" aria-hidden />
                {optimizingSvg ? "Optimizing…" : "Optimize SVG"}
              </DropdownMenuItem>
            )}
            {!isInfected && isAudio && (
              <DropdownMenuItem onSelect={() => setAudioTrimOpen(true)}>
                <AudioLines className="size-3.5" aria-hidden />
                Trim audio
              </DropdownMenuItem>
            )}
            {!isInfected && isVideo && (
              <DropdownMenuItem onSelect={() => setVideoTrimOpen(true)}>
                <Scissors className="size-3.5" aria-hidden />
                Trim video
              </DropdownMenuItem>
            )}
            {!isInfected && isVideo && (
              <DropdownMenuItem onSelect={() => setPublishReelOpen(true)}>
                <Clapperboard className="size-3.5" aria-hidden />
                Publish to Reels
              </DropdownMenuItem>
            )}
            {!isInfected && isDocx && (
              <DropdownMenuItem onSelect={() => setDocxEditOpen(true)}>
                <FileEdit className="size-3.5" aria-hidden />
                Edit document
              </DropdownMenuItem>
            )}
            {!isInfected && isXlsx && (
              <DropdownMenuItem onSelect={() => setXlsxEditOpen(true)}>
                <FileEdit className="size-3.5" aria-hidden />
                Edit spreadsheet
              </DropdownMenuItem>
            )}
            {!isInfected && isPdf && (
              <DropdownMenuItem onSelect={() => setPdfEditOpen(true)}>
                <FileEdit className="size-3.5" aria-hidden />
                Edit text (OCR)
              </DropdownMenuItem>
            )}
            {!isInfected && isPdf && (
              <>
                <DropdownMenuItem onSelect={() => setPdfToolMode("rotate")}>
                  <RotateCw className="size-3.5" aria-hidden />
                  Rotate pages
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPdfToolMode("extract")}>
                  <Scissors className="size-3.5" aria-hidden />
                  Extract pages
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPdfToolMode("watermark")}>
                  <Stamp className="size-3.5" aria-hidden />
                  Add watermark
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPdfToolMode("compress")}>
                  <Minimize2 className="size-3.5" aria-hidden />
                  Compress
                </DropdownMenuItem>
              </>
            )}
            {!isInfected &&
              conversions.map((ext) => (
                <DropdownMenuItem key={ext} disabled={converting} onSelect={() => handleConvert(ext)}>
                  <FileOutput className="size-3.5" aria-hidden />
                  {converting ? "Converting…" : `Convert to ${ext.toUpperCase()}`}
                </DropdownMenuItem>
              ))}
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
      )}

      <div className="flex flex-col gap-1 p-2.5">
        <span className="truncate text-xs text-ink" title={name}>
          {name}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[0.65rem] text-ink-faint">{formatBytes(size)}</span>
          {isInfected && (
            <Badge className="border-danger/40 px-1.5 py-0 text-[0.6rem] text-danger">
              <ShieldAlert className="size-2.5" aria-hidden />
              Flagged
            </Badge>
          )}
          {isScanning && (
            <Badge className="px-1.5 py-0 text-[0.6rem] text-ink-faint">
              <Loader2 className="size-2.5 animate-spin" aria-hidden />
              Scanning
            </Badge>
          )}
          {isDuplicate && (
            <Badge className="border-warning/40 px-1.5 py-0 text-[0.6rem] text-warning">Dup</Badge>
          )}
        </div>
        {convertError && <p className="text-[0.65rem] text-danger">{convertError}</p>}
      </div>

      <ShareDialog fileId={id} fileName={name} open={shareOpen} onOpenChange={setShareOpen} />
      <MoveFileDialog fileId={id} currentFolderId={folderId} open={moveOpen} onOpenChange={setMoveOpen} />
      {previewable && (
        <PreviewDialog fileId={id} fileName={name} mimeType={mimeType} open={previewOpen} onOpenChange={setPreviewOpen} />
      )}
      {isImage && (
        <ImageEditorDialog fileId={id} fileName={name} folderId={folderId} open={editorOpen} onOpenChange={setEditorOpen} />
      )}
      {isAudio && (
        <AudioTrimDialog fileId={id} fileName={name} folderId={folderId} open={audioTrimOpen} onOpenChange={setAudioTrimOpen} />
      )}
      {isVideo && (
        <PublishReelDialog fileId={id} fileName={name} open={publishReelOpen} onOpenChange={setPublishReelOpen} />
      )}
      {isVideo && (
        <VideoTrimDialog fileId={id} fileName={name} folderId={folderId} open={videoTrimOpen} onOpenChange={setVideoTrimOpen} />
      )}
      {isPdf && pdfToolMode && (
        <PdfToolDialog
          mode={pdfToolMode}
          fileId={id}
          fileName={name}
          folderId={folderId}
          open={pdfToolMode !== null}
          onOpenChange={(next) => setPdfToolMode(next ? pdfToolMode : null)}
        />
      )}
      {isDocx && <DocxEditorDialog fileId={id} fileName={name} open={docxEditOpen} onOpenChange={setDocxEditOpen} />}
      {isXlsx && <XlsxEditorDialog fileId={id} fileName={name} open={xlsxEditOpen} onOpenChange={setXlsxEditOpen} />}
      {isPdf && <PdfOcrEditorDialog fileId={id} fileName={name} open={pdfEditOpen} onOpenChange={setPdfEditOpen} />}

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
        <DialogContent title={`Delete "${name}"?`} description="Moves to trash — you can restore it within 30 days.">
          <form
            action={async () => {
              await deleteFile(id);
              setDeleteOpen(false);
            }}
          >
            <Button type="submit" variant="ghost" className="w-full border-danger/40 text-danger hover:border-danger">
              Delete file
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
});
