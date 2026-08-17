"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { uploadFile } from "@/lib/client-upload";
import { getPageCount, rotatePdf, extractPages, addWatermark, compressPdf, parsePageRanges } from "@/lib/pdf-tools";

type Mode = "rotate" | "extract" | "watermark" | "compress";

const MODE_LABEL: Record<Mode, string> = {
  rotate: "Rotate pages",
  extract: "Extract pages",
  watermark: "Add watermark",
  compress: "Compress",
};

export function PdfToolDialog({
  mode,
  fileId,
  fileName,
  folderId,
  open,
  onOpenChange,
}: {
  mode: Mode;
  fileId: string;
  fileName: string;
  folderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pageRanges, setPageRanges] = useState("");
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [rotateBy, setRotateBy] = useState<90 | 180 | 270>(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/files/${fileId}/download?inline=1`)
      .then((res) => res.arrayBuffer())
      .then(getPageCount)
      .then((count) => {
        if (cancelled) return;
        setPageCount(count);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't read this PDF.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, fileId]);

  async function handleRun() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/download?inline=1`);
      const bytes = await res.arrayBuffer();
      const baseName = fileName.replace(/\.pdf$/i, "");

      let outBytes: Uint8Array;
      let outName: string;
      if (mode === "rotate") {
        outBytes = await rotatePdf(bytes, rotateBy);
        outName = `${baseName} (rotated).pdf`;
      } else if (mode === "extract") {
        if (!pageCount) throw new Error("Page count unknown.");
        const pages = parsePageRanges(pageRanges, pageCount);
        if (pages.length === 0) throw new Error("No valid pages selected.");
        outBytes = await extractPages(bytes, pages);
        outName = `${baseName} (pages).pdf`;
      } else if (mode === "watermark") {
        outBytes = await addWatermark(bytes, watermarkText);
        outName = `${baseName} (watermarked).pdf`;
      } else {
        outBytes = await compressPdf(bytes);
        outName = `${baseName} (compressed).pdf`;
      }

      const file = new File([new Uint8Array(outBytes)], outName, { type: "application/pdf" });
      await uploadFile(file, folderId, () => {});
      onOpenChange(false);
    } catch {
      setError("Couldn't process this PDF. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={MODE_LABEL[mode]} className="flex flex-col gap-4">
        {pageCount === null && !error ? (
          <p className="text-sm text-ink-faint">Loading…</p>
        ) : (
          <>
            {mode === "rotate" && (
              <div className="flex items-center justify-center gap-2">
                {([90, 180, 270] as const).map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => setRotateBy(deg)}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      rotateBy === deg ? "border-accent text-accent" : "border-border text-ink-muted"
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            )}

            {mode === "extract" && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-ink-faint">
                  {pageCount} page{pageCount === 1 ? "" : "s"} total. Enter pages or ranges, e.g. 1-3,5,8-10
                </p>
                <Input
                  value={pageRanges}
                  onChange={(e) => setPageRanges(e.target.value)}
                  placeholder="1-3,5"
                  autoFocus
                />
              </div>
            )}

            {mode === "watermark" && (
              <Input
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="Watermark text"
                autoFocus
              />
            )}

            {mode === "compress" && (
              <p className="text-xs text-ink-faint">
                Removes redundant/duplicate objects and metadata. Works best on text-heavy PDFs —
                won&apos;t shrink already-image-heavy PDFs much, since re-compressing embedded
                images isn&apos;t possible in-browser yet.
              </p>
            )}

            {error && <p className="text-xs text-danger">{error}</p>}

            <Button type="button" variant="accent" className="w-full" disabled={busy} onClick={handleRun}>
              {busy ? "Processing…" : "Save as new file"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
