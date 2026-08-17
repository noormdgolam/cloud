"use client";

import { memo } from "react";
import { Check, MoreHorizontal, Download, Pencil, Trash2, Share2, FolderInput, Wand2, FileOutput, RotateCw, Scissors, Stamp, ShieldOff, Minimize2, Sparkles, AudioLines, Clapperboard, ShieldAlert, Loader2, FileEdit } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FileScanStatus } from "@/lib/data/browser";
import { formatBytes, formatRelativeDate } from "@/lib/format";
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

export const FileRow = memo(function FileRow({
  id,
  name,
  size,
  mimeType,
  createdAt,
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
  createdAt: Date;
  folderId?: string | null;
  isDuplicate?: boolean;
  scanStatus?: FileScanStatus;
  /** Presence of onToggleSelect (not just its value) is what puts the row into selection mode. */
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


  return (
    <>
    {convertError && <p className="px-3.5 text-xs text-danger">{convertError}</p>}
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors hover:bg-[var(--glass-surface-hover)]",
        selected && "bg-[var(--glass-surface)]"
      )}
    >
      {selectMode ? (
        <button
          type="button"
          onClick={onToggleSelect}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-pressed={selected}
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg border",
              selected ? "border-accent bg-accent text-white" : "border-border bg-bg-2 text-ink-muted"
            )}
          >
            {selected ? <Check className="size-4" aria-hidden /> : mimeIcon(mimeType, "size-4")}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{name}</span>
        </button>
      ) : isInfected ? (
        <span
          className="flex min-w-0 flex-1 items-center gap-3 text-left opacity-60"
          title="This file was flagged as malicious and can't be previewed or downloaded"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-danger/40 bg-bg-2">
            {mimeIcon(mimeType, "size-4 text-danger")}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{name}</span>
        </span>
      ) : previewable ? (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          title={`Preview ${name}`}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-2">
            {mimeIcon(mimeType, "size-4 text-ink-muted")}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{name}</span>
        </button>
      ) : (
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
      )}
      {isInfected && (
        <Badge className="border-danger/40 text-danger" title="Flagged by a malware scan">
          <ShieldAlert className="size-3" aria-hidden />
          Flagged
        </Badge>
      )}
      {isScanning && (
        <Badge className="hidden text-ink-faint sm:inline-flex" title="Malware scan in progress">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          Scanning
        </Badge>
      )}
      {isDuplicate && (
        <Badge
          className="hidden border-warning/40 text-warning sm:inline-flex"
          title="Another file with identical content exists in your storage"
        >
          Duplicate
        </Badge>
      )}
      <span className="hidden font-mono text-xs text-ink-faint sm:block">
        {formatRelativeDate(createdAt)}
      </span>
      <span className="font-mono text-xs text-ink-faint">{formatBytes(size)}</span>

      {!selectMode && (
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

      <ShareDialog fileId={id} fileName={name} open={shareOpen} onOpenChange={setShareOpen} />
      <MoveFileDialog fileId={id} currentFolderId={folderId} open={moveOpen} onOpenChange={setMoveOpen} />
      {previewable && (
        <PreviewDialog
          fileId={id}
          fileName={name}
          mimeType={mimeType}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
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
    </>
  );
});

