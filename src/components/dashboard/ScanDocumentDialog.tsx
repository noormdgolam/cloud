"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, FileText, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { uploadFile } from "@/lib/client-upload";
import {
  applyGrayscale,
  applyMagicColor,
  applyScanBW,
  defaultCorners,
  imagesToPdf,
  pointDistance,
  type Point,
} from "@/lib/scan-tools";
import { CornerAdjustOverlay } from "./CornerAdjustOverlay";

type ScanFilter = "original" | "grayscale" | "bw" | "magic";

const FILTERS: { id: ScanFilter; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "magic", label: "Enhance" },
  { id: "grayscale", label: "Grayscale" },
  { id: "bw", label: "B&W Scan" },
];

const DISPLAY_MAX_DESKTOP = 420;

type CompletedPage = { canvas: HTMLCanvasElement; thumbUrl: string };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function applyFilter(canvas: HTMLCanvasElement, filter: ScanFilter) {
  if (filter === "grayscale") applyGrayscale(canvas);
  else if (filter === "bw") applyScanBW(canvas);
  else if (filter === "magic") applyMagicColor(canvas);
}

export function ScanDocumentDialog({
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
  const [pageIndex, setPageIndex] = useState(0);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [loadedFileId, setLoadedFileId] = useState<string | null>(null);
  const [corners, setCorners] = useState<[Point, Point, Point, Point] | null>(null);
  const [filter, setFilter] = useState<ScanFilter>("magic");
  const [completed, setCompleted] = useState<CompletedPage[]>([]);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayMax, setDisplayMax] = useState(DISPLAY_MAX_DESKTOP);

  useEffect(() => {
    function update() {
      setDisplayMax(Math.min(DISPLAY_MAX_DESKTOP, window.innerWidth - 80));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const currentFileId = fileIds[pageIndex];
  const done = pageIndex >= fileIds.length;
  const isCurrentLoaded = source !== null && loadedFileId === currentFileId;

  useEffect(() => {
    if (!open || done || !currentFileId) return;
    let cancelled = false;
    loadImage(`/api/files/${currentFileId}/download?inline=1`).then((img) => {
      if (cancelled) return;
      setSource(img);
      setCorners(defaultCorners(img.naturalWidth, img.naturalHeight));
      setLoadedFileId(currentFileId);
    });
    return () => {
      cancelled = true;
    };
  }, [open, currentFileId, done]);

  const displaySize = useMemo(() => {
    if (!source) return { w: 0, h: 0, scale: 1 };
    const scale = Math.min(1, displayMax / Math.max(source.naturalWidth, source.naturalHeight));
    return { w: Math.round(source.naturalWidth * scale), h: Math.round(source.naturalHeight * scale), scale };
  }, [source, displayMax]);

  const displayCorners = useMemo<[Point, Point, Point, Point] | null>(() => {
    if (!corners) return null;
    return corners.map((c) => ({ x: c.x * displaySize.scale, y: c.y * displaySize.scale })) as [
      Point,
      Point,
      Point,
      Point,
    ];
  }, [corners, displaySize.scale]);

  function handleDisplayCornersChange(next: [Point, Point, Point, Point]) {
    const scale = displaySize.scale || 1;
    setCorners(next.map((c) => ({ x: c.x / scale, y: c.y / scale })) as [Point, Point, Point, Point]);
  }

  function addPage() {
    if (!source || !corners) return;
    const outW = Math.round((pointDistance(corners[0], corners[1]) + pointDistance(corners[3], corners[2])) / 2) || 1;
    const outH = Math.round((pointDistance(corners[0], corners[3]) + pointDistance(corners[1], corners[2])) / 2) || 1;

    // warpPerspective is dynamically imported at build time via the static
    // import above — kept as a direct call here for clarity.
    import("@/lib/scan-tools").then(({ warpPerspective }) => {
      const warped = warpPerspective(source, corners, outW, outH);
      applyFilter(warped, filter);
      const thumbUrl = warped.toDataURL("image/jpeg", 0.6);
      setCompleted((prev) => [...prev, { canvas: warped, thumbUrl }]);
      setPageIndex((i) => i + 1);
    });
  }

  function removePage(index: number) {
    setCompleted((prev) => prev.filter((_, i) => i !== index));
  }

  function movePage(index: number, dir: -1 | 1) {
    setCompleted((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleExport() {
    if (completed.length === 0) return;
    setExporting(true);
    setError(null);
    try {
      const pdfBytes = await imagesToPdf(completed.map((p) => ({ canvas: p.canvas, mime: "image/jpeg" })));
      const file = new File([new Uint8Array(pdfBytes)], "Scanned document.pdf", { type: "application/pdf" });
      await uploadFile(file, folderId, () => {});
      onOpenChange(false);
      onDone();
    } catch {
      setError("Couldn't export the scan. Try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Scan document"
        description={done ? undefined : `Page ${pageIndex + 1} of ${fileIds.length} — drag the corners to trace the page`}
        className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-4 overflow-y-auto p-4"
      >
        {!done && (
          <>
            {!isCurrentLoaded || !source || !displayCorners ? (
              <p className="p-10 text-center text-sm text-ink-faint">Loading…</p>
            ) : (
              <>
                <div
                  className="relative mx-auto touch-none select-none overflow-hidden rounded-xl bg-bg-2"
                  style={{ width: displaySize.w, height: displaySize.h }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary user-uploaded content, not a build-time-known asset */}
                  <img
                    src={source.src}
                    alt=""
                    className="absolute inset-0 h-full w-full object-fill"
                    draggable={false}
                  />
                  <CornerAdjustOverlay
                    displayWidth={displaySize.w}
                    displayHeight={displaySize.h}
                    corners={displayCorners}
                    onChange={handleDisplayCornersChange}
                  />
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        filter === f.id ? "border-accent text-accent" : "border-border text-ink-muted"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <Button type="button" variant="accent" className="w-full" onClick={addPage}>
                  <Check className="size-3.5" aria-hidden />
                  Use this page
                </Button>
              </>
            )}
          </>
        )}

        {completed.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-ink-muted">
              {completed.length} page{completed.length === 1 ? "" : "s"} scanned
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {completed.map((page, i) => (
                <div key={i} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local canvas-generated data URI, not a static asset */}
                  <img
                    src={page.thumbUrl}
                    alt={`Page ${i + 1}`}
                    className="h-24 w-auto rounded-lg border border-border object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between rounded-b-lg bg-black/60 px-1 py-0.5">
                    <button
                      type="button"
                      onClick={() => movePage(i, -1)}
                      disabled={i === 0}
                      className="p-0.5 text-white disabled:opacity-30"
                      aria-label="Move earlier"
                    >
                      <ArrowUp className="size-3" aria-hidden />
                    </button>
                    <span className="text-[0.65rem] text-white">{i + 1}</span>
                    <button
                      type="button"
                      onClick={() => movePage(i, 1)}
                      disabled={i === completed.length - 1}
                      className="p-0.5 text-white disabled:opacity-30"
                      aria-label="Move later"
                    >
                      <ArrowDown className="size-3" aria-hidden />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePage(i)}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-danger text-white"
                    aria-label="Remove page"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-center text-xs text-danger">{error}</p>}

        {completed.length > 0 && (
          <Button type="button" variant="accent" className="w-full" disabled={exporting} onClick={handleExport}>
            <FileText className="size-3.5" aria-hidden />
            {exporting ? "Exporting…" : `Export ${completed.length}-page PDF`}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
