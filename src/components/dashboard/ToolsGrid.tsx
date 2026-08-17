"use client";

import { useState } from "react";
import {
  Wand2,
  ShieldOff,
  Sparkles,
  AudioLines,
  Mic2,
  RotateCw,
  Scissors,
  Stamp,
  Minimize2,
  Combine,
  FileOutput,
  ScanLine,
  Clapperboard,
  FileAudio,
} from "lucide-react";
import { stripImageMetadata } from "@/lib/strip-metadata";
import { optimizeSvg } from "@/lib/optimize-svg";
import { uploadFile } from "@/lib/client-upload";
import { convertFile } from "@/lib/actions/convert-actions";
import { supportedConversions } from "@/lib/convert/supported";
import type { PickerFile } from "@/lib/actions/file-actions";
import { FilePickerDialog } from "./FilePickerDialog";
import { ImageEditorDialog } from "./ImageEditorDialog";
import { AudioTrimDialog } from "./AudioTrimDialog";
import { AudioEnhanceDialog } from "./AudioEnhanceDialog";
import { VideoToAudioDialog } from "./VideoToAudioDialog";
import { PdfToolDialog } from "./PdfToolDialog";
import { MergePdfsDialog } from "./MergePdfsDialog";
import { ScanDocumentDialog } from "./ScanDocumentDialog";
import { ReelsGeneratorDialog } from "./ReelsGeneratorDialog";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type PdfMode = "rotate" | "extract" | "watermark" | "compress";
type ToolKind =
  | "image-edit"
  | "scan-document"
  | "make-reel"
  | "strip-metadata"
  | "optimize-svg"
  | "audio-trim"
  | "audio-enhance"
  | "video-to-audio"
  | `pdf-${PdfMode}`
  | "merge"
  | "convert";
type Category = "Images" | "Audio & Video" | "PDF & Documents";

const isImageMime = (m: string) => m.startsWith("image/") && m !== "image/svg+xml";
const isSvgMime = (m: string) => m === "image/svg+xml";
const isAudioMime = (m: string) => m.startsWith("audio/");
const isVideoMime = (m: string) => m.startsWith("video/");
const isPdfMime = (m: string) => m === "application/pdf";
// Mirrors supportedConversions() exactly — isImageMime alone is broader
// than what's actually convertible (only jpg/png -> pdf), which would let
// the picker show e.g. a webp file that then dead-ends on "no conversion".
const isConvertibleMime = (m: string) =>
  isPdfMime(m) ||
  m.includes("wordprocessingml") ||
  m.includes("spreadsheetml") ||
  m === "application/vnd.ms-excel" ||
  m === "image/jpeg" ||
  m === "image/png";

const TOOLS: {
  id: ToolKind;
  label: string;
  description: string;
  icon: typeof Wand2;
  accept: (m: string) => boolean;
  category: Category;
  multiple?: boolean;
  minSelected?: number;
}[] = [
  { id: "image-edit", label: "Edit image", description: "Crop, rotate, perspective, scan filters & format", icon: Wand2, accept: isImageMime, category: "Images" },
  { id: "scan-document", label: "Scan document", description: "Trace pages, apply scan filters, export as PDF", icon: ScanLine, accept: isImageMime, category: "Images", multiple: true, minSelected: 1 },
  { id: "strip-metadata", label: "Remove metadata", description: "Strip EXIF/GPS data from a photo", icon: ShieldOff, accept: isImageMime, category: "Images" },
  { id: "optimize-svg", label: "Optimize SVG", description: "Shrink file size, strip cruft", icon: Sparkles, accept: isSvgMime, category: "Images" },
  { id: "make-reel", label: "Create a reel", description: "Images + captions + music → one video", icon: Clapperboard, accept: isImageMime, category: "Audio & Video", multiple: true, minSelected: 1 },
  { id: "video-to-audio", label: "Video to audio", description: "Extract the soundtrack as MP3 or WAV", icon: FileAudio, accept: isVideoMime, category: "Audio & Video" },
  { id: "audio-trim", label: "Trim audio", description: "Cut an audio clip down to size", icon: AudioLines, accept: isAudioMime, category: "Audio & Video" },
  { id: "audio-enhance", label: "Enhance audio", description: "One-click AI beautification — noise removal, compression & normalisation", icon: Mic2, accept: isAudioMime, category: "Audio & Video" },
  { id: "pdf-rotate", label: "Rotate PDF pages", description: "Rotate every page 90/180/270°", icon: RotateCw, accept: isPdfMime, category: "PDF & Documents" },
  { id: "pdf-extract", label: "Extract PDF pages", description: "Pull specific pages into a new file", icon: Scissors, accept: isPdfMime, category: "PDF & Documents" },
  { id: "pdf-watermark", label: "Watermark PDF", description: "Stamp text across every page", icon: Stamp, accept: isPdfMime, category: "PDF & Documents" },
  { id: "pdf-compress", label: "Compress PDF", description: "Dedupe objects, shrink structure", icon: Minimize2, accept: isPdfMime, category: "PDF & Documents" },
  { id: "merge", label: "Merge PDFs", description: "Combine multiple PDFs into one", icon: Combine, accept: isPdfMime, category: "PDF & Documents", multiple: true, minSelected: 2 },
  { id: "convert", label: "Convert format", description: "docx/xlsx ⇄ PDF, images → PDF", icon: FileOutput, accept: isConvertibleMime, category: "PDF & Documents" },
];
const CATEGORIES: Category[] = ["Images", "Audio & Video", "PDF & Documents"];

export function ToolsGrid() {
  const [activeTool, setActiveTool] = useState<ToolKind | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [editorTarget, setEditorTarget] = useState<PickerFile | null>(null);
  const [audioTarget, setAudioTarget] = useState<PickerFile | null>(null);
  const [audioEnhanceTarget, setAudioEnhanceTarget] = useState<PickerFile | null>(null);
  const [videoToAudioTarget, setVideoToAudioTarget] = useState<PickerFile | null>(null);
  const [pdfTarget, setPdfTarget] = useState<{ file: PickerFile; mode: PdfMode } | null>(null);
  const [mergeTargets, setMergeTargets] = useState<PickerFile[] | null>(null);
  const [scanTargets, setScanTargets] = useState<PickerFile[] | null>(null);
  const [reelTargets, setReelTargets] = useState<PickerFile[] | null>(null);
  const [convertTarget, setConvertTarget] = useState<PickerFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const [inlineBusy, setInlineBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineSuccess, setInlineSuccess] = useState<string | null>(null);

  const tool = TOOLS.find((t) => t.id === activeTool) ?? null;

  function openTool(id: ToolKind) {
    setActiveTool(id);
    setInlineError(null);
    setInlineSuccess(null);
    setPickerOpen(true);
  }

  async function handlePicked(files: PickerFile[]) {
    const file = files[0];
    switch (activeTool) {
      case "image-edit":
        setEditorTarget(file);
        break;
      case "audio-trim":
        setAudioTarget(file);
        break;
      case "audio-enhance":
        setAudioEnhanceTarget(file);
        break;
      case "video-to-audio":
        setVideoToAudioTarget(file);
        break;
      case "pdf-rotate":
      case "pdf-extract":
      case "pdf-watermark":
      case "pdf-compress":
        setPdfTarget({ file, mode: activeTool.replace("pdf-", "") as PdfMode });
        break;
      case "merge":
        setMergeTargets(files);
        break;
      case "scan-document":
        setScanTargets(files);
        break;
      case "make-reel":
        setReelTargets(files);
        break;
      case "convert":
        setConvertTarget(file);
        break;
      case "strip-metadata":
        await runStripMetadata(file);
        break;
      case "optimize-svg":
        await runOptimizeSvg(file);
        break;
    }
  }

  async function runStripMetadata(file: PickerFile) {
    setInlineBusy(true);
    setInlineError(null);
    try {
      const blob = await stripImageMetadata(`/api/files/${file.id}/download?inline=1`, file.mimeType);
      const cleanedName = `${file.name.replace(/\.[^.]+$/, "")} (no metadata)${file.name.match(/\.[^.]+$/)?.[0] ?? ""}`;
      await uploadFile(new File([blob], cleanedName, { type: blob.type }), file.folderId, () => {});
      setInlineSuccess(`Saved "${cleanedName}" without metadata.`);
    } catch {
      setInlineError(`Couldn't remove metadata from ${file.name}.`);
    } finally {
      setInlineBusy(false);
    }
  }

  async function runOptimizeSvg(file: PickerFile) {
    setInlineBusy(true);
    setInlineError(null);
    try {
      const blob = await optimizeSvg(`/api/files/${file.id}/download`);
      const optimizedName = `${file.name.replace(/\.svg$/i, "")} (optimized).svg`;
      await uploadFile(new File([blob], optimizedName, { type: "image/svg+xml" }), file.folderId, () => {});
      setInlineSuccess(`Saved "${optimizedName}".`);
    } catch {
      setInlineError(`Couldn't optimize ${file.name}.`);
    } finally {
      setInlineBusy(false);
    }
  }

  async function runConvert(toExt: string) {
    if (!convertTarget) return;
    setConverting(true);
    setConvertError(null);
    try {
      await convertFile(convertTarget.id, toExt);
      setInlineSuccess(`Converted "${convertTarget.name}" to ${toExt.toUpperCase()}.`);
      setConvertTarget(null);
    } catch {
      setConvertError(`Couldn't convert ${convertTarget.name}.`);
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {inlineSuccess && (
        <p className="rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-sm text-ink">{inlineSuccess}</p>
      )}
      {inlineError && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{inlineError}</p>
      )}

      {CATEGORIES.map((category) => (
        <div key={category} className="flex flex-col gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-faint">{category}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.filter((t) => t.category === category).map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={inlineBusy}
                onClick={() => openTool(t.id)}
                className="glass flex flex-col items-start gap-2.5 rounded-2xl p-5 text-left transition-colors hover:bg-[var(--glass-surface-hover)] disabled:opacity-50"
              >
                <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-bg-2 text-accent-2">
                  <t.icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="text-sm font-medium text-ink">
                  {inlineBusy && activeTool === t.id ? "Working…" : t.label}
                </span>
                <span className="text-xs text-ink-faint">{t.description}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {tool && (
        <FilePickerDialog
          key={tool.id}
          title={`Pick a file for “${tool.label}”`}
          accept={tool.accept}
          multiple={tool.multiple}
          minSelected={tool.minSelected ?? 1}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={handlePicked}
        />
      )}

      {editorTarget && (
        <ImageEditorDialog
          fileId={editorTarget.id}
          fileName={editorTarget.name}
          folderId={editorTarget.folderId}
          open={editorTarget !== null}
          onOpenChange={(open) => !open && setEditorTarget(null)}
        />
      )}
      {audioTarget && (
        <AudioTrimDialog
          fileId={audioTarget.id}
          fileName={audioTarget.name}
          folderId={audioTarget.folderId}
          open={audioTarget !== null}
          onOpenChange={(open) => !open && setAudioTarget(null)}
        />
      )}
      {audioEnhanceTarget && (
        <AudioEnhanceDialog
          fileId={audioEnhanceTarget.id}
          fileName={audioEnhanceTarget.name}
          folderId={audioEnhanceTarget.folderId}
          open={audioEnhanceTarget !== null}
          onOpenChange={(open) => !open && setAudioEnhanceTarget(null)}
        />
      )}
      {videoToAudioTarget && (
        <VideoToAudioDialog
          fileId={videoToAudioTarget.id}
          fileName={videoToAudioTarget.name}
          folderId={videoToAudioTarget.folderId}
          open={videoToAudioTarget !== null}
          onOpenChange={(open) => !open && setVideoToAudioTarget(null)}
        />
      )}
      {pdfTarget && (
        <PdfToolDialog
          mode={pdfTarget.mode}
          fileId={pdfTarget.file.id}
          fileName={pdfTarget.file.name}
          folderId={pdfTarget.file.folderId}
          open={pdfTarget !== null}
          onOpenChange={(open) => !open && setPdfTarget(null)}
        />
      )}
      {mergeTargets && (
        <MergePdfsDialog
          fileIds={mergeTargets.map((f) => f.id)}
          folderId={null}
          open={mergeTargets !== null}
          onOpenChange={(open) => !open && setMergeTargets(null)}
          onDone={() => setInlineSuccess(`Merged ${mergeTargets.length} PDFs.`)}
        />
      )}
      {scanTargets && (
        <ScanDocumentDialog
          fileIds={scanTargets.map((f) => f.id)}
          folderId={null}
          open={scanTargets !== null}
          onOpenChange={(open) => !open && setScanTargets(null)}
          onDone={() => setInlineSuccess(`Scanned ${scanTargets.length}-page document saved as a PDF.`)}
        />
      )}
      {reelTargets && (
        <ReelsGeneratorDialog
          fileIds={reelTargets.map((f) => f.id)}
          folderId={null}
          open={reelTargets !== null}
          onOpenChange={(open) => !open && setReelTargets(null)}
          onDone={() => setInlineSuccess("Reel saved to your files.")}
        />
      )}

      <Dialog open={convertTarget !== null} onOpenChange={(open) => !open && setConvertTarget(null)}>
        <DialogContent title={convertTarget ? `Convert “${convertTarget.name}”` : "Convert"}>
          {convertTarget && (
            <div className="flex flex-col gap-3">
              {supportedConversions(convertTarget.name, convertTarget.mimeType).length === 0 ? (
                <p className="text-sm text-ink-faint">No supported conversion for this file type.</p>
              ) : (
                supportedConversions(convertTarget.name, convertTarget.mimeType).map((ext) => (
                  <Button key={ext} type="button" variant="accent" disabled={converting} onClick={() => runConvert(ext)}>
                    {converting ? "Converting…" : `Convert to ${ext.toUpperCase()}`}
                  </Button>
                ))
              )}
              {convertError && <p className="text-xs text-danger">{convertError}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
