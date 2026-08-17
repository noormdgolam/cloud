"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, ScanText } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Block } from "@/lib/convert/html-blocks";
import { replaceFileContent } from "@/lib/client-replace";

const PDF_MIME = "application/pdf";

// Plain-text editing surface for a page's extracted/OCR'd content — simpler
// than a rich per-block editor, and directly matches how the feature was
// asked for ("edit ocr text"). "# "/"## " prefixes mark headings; blank
// lines separate paragraphs.
function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.kind === "heading") return `${"#".repeat(b.level === 1 ? 1 : 2)} ${b.runs.map((r) => r.text).join("")}`;
      if (b.kind === "listitem") return `${b.ordered ? `${b.index}.` : "•"} ${b.runs.map((r) => r.text).join("")}`;
      return b.runs.map((r) => r.text).join("");
    })
    .join("\n\n");
}

function textToBlocks(text: string): Block[] {
  return text
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): Block => {
      if (chunk.startsWith("## ")) return { kind: "heading", level: 2, runs: [{ text: chunk.slice(3) }] };
      if (chunk.startsWith("# ")) return { kind: "heading", level: 1, runs: [{ text: chunk.slice(2) }] };
      return { kind: "paragraph", runs: [{ text: chunk.replace(/\s+/g, " ") }] };
    });
}

type PageState = { thumbnailUrl: string; usedOcr: boolean; text: string };

export function PdfOcrEditorDialog({
  fileId,
  fileName,
  open,
  onOpenChange,
  onSaved,
}: {
  fileId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const [pages, setPages] = useState<PageState[] | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPages(null);
    setActivePage(0);
    setError(null);
    setProgress(null);

    (async () => {
      try {
        const res = await fetch(`/api/files/${fileId}/download?inline=1`);
        if (!res.ok) throw new Error("fetch failed");
        const buffer = await res.arrayBuffer();
        const { loadPdfPages } = await import("@/lib/convert/pdf-page-to-blocks");
        const loaded = await loadPdfPages(buffer, (done, total) => {
          if (!cancelled) setProgress({ done, total });
        });
        if (cancelled) return;
        setPages(loaded.map((p) => ({ thumbnailUrl: p.thumbnailUrl, usedOcr: p.usedOcr, text: blocksToText(p.blocks) })));
      } catch {
        if (!cancelled) setError("Couldn't read this PDF.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, fileId]);

  function updatePageText(index: number, text: string) {
    setPages((prev) => (prev ? prev.map((p, i) => (i === index ? { ...p, text } : p)) : prev));
  }

  async function handleSave() {
    if (!pages) return;
    setSaving(true);
    setError(null);
    try {
      const { PdfTextWriter } = await import("@/lib/convert/pdf-text-writer");
      const writer = await PdfTextWriter.create();
      for (const page of pages) {
        for (const block of textToBlocks(page.text)) {
          if (block.kind === "heading") writer.addHeading(block.runs.map((r) => r.text).join(""), block.level);
          else if (block.kind === "listitem") writer.addListItem(block.runs, block.ordered, block.index);
          else writer.addParagraph(block.runs);
        }
      }
      const bytes = await writer.save();
      await replaceFileContent(fileId, new Uint8Array(bytes), PDF_MIME, fileName);
      router.refresh();
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const current = pages?.[activePage];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Edit ${fileName}`}
        className="fixed left-0 top-0 flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 flex-col gap-3 rounded-none p-4 sm:p-6"
      >
        <div className="flex items-start gap-2 rounded-xl border border-border-strong bg-bg-2 px-3 py-2 text-xs text-ink-faint">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Extracted text only — saving regenerates a new, cleanly laid-out PDF from the edited text. Diagrams,
            photos, and the original page&apos;s exact layout aren&apos;t carried into the saved file.
          </span>
        </div>

        {!pages ? (
          <p className="p-10 text-center text-sm text-ink-faint">
            {error ?? (progress ? `Reading page ${progress.done} of ${progress.total}…` : "Loading…")}
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 gap-3">
            <div className="flex w-24 shrink-0 flex-col gap-2 overflow-y-auto">
              {pages.map((page, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActivePage(i)}
                  className={cn(
                    "relative overflow-hidden rounded-lg border",
                    activePage === i ? "border-accent" : "border-border"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- data: URL page thumbnail, not a static asset */}
                  <img src={page.thumbnailUrl} alt={`Page ${i + 1}`} className="w-full" />
                  {page.usedOcr && (
                    <span className="absolute bottom-1 right-1 rounded-full bg-bg-1/80 p-1" title="Read via OCR">
                      <ScanText className="size-3 text-accent-2" aria-hidden />
                    </span>
                  )}
                  <span className="absolute left-1 top-1 rounded bg-bg-1/80 px-1.5 text-[0.65rem] text-ink">
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
            <textarea
              value={current?.text ?? ""}
              onChange={(e) => updatePageText(activePage, e.target.value)}
              className="min-h-0 flex-1 resize-none rounded-xl border border-border bg-bg-2 p-3 font-mono text-sm text-ink focus:outline-none"
            />
          </div>
        )}

        {error && pages && <p className="text-xs text-danger">{error}</p>}

        <Button type="button" variant="accent" className="w-full" disabled={saving || !pages} onClick={handleSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
