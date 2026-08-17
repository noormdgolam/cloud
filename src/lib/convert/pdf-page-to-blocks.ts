"use client";

import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { Block } from "./html-blocks";
import { ocrImage } from "./pdf-ocr";

// Bundler-standard worker setup (webpack/Turbopack both understand this
// `new URL(..., import.meta.url)` convention) — this file is only ever
// reached via a dynamic import() from the editor dialog, so pdfjs-dist and
// its ~1.7MB worker+core never load until a user actually opens a PDF to
// edit, and never touch the app's main bundle.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export type PdfPage = { blocks: Block[]; thumbnailUrl: string; usedOcr: boolean };

function isTextItem(item: TextItem | { type: string }): item is TextItem {
  return "str" in item;
}

// Groups pdf.js's flat, per-glyph-run text items into blocks using simple
// position heuristics: items whose baseline Y is within a tight tolerance
// share a line; a Y-gap larger than ~1.6x the median line height starts a
// new paragraph; a line whose glyph height is notably larger than the
// median body-text height is treated as a heading. This reflows real text
// layer content — it does not preserve the original page's exact layout
// (multi-column/table PDFs will reflow into a single linear stream).
function textItemsToBlocks(items: TextItem[]): Block[] {
  if (items.length === 0) return [];

  type Line = { y: number; height: number; text: string };
  const lines: Line[] = [];
  let currentY: number | null = null;
  let currentHeight = 0;
  let currentParts: { x: number; text: string }[] = [];

  const flush = () => {
    if (currentParts.length === 0) return;
    currentParts.sort((a, b) => a.x - b.x);
    lines.push({ y: currentY ?? 0, height: currentHeight, text: currentParts.map((p) => p.text).join(" ").trim() });
    currentParts = [];
  };

  for (const item of items) {
    const y = item.transform[5];
    const height = item.height || 10;
    if (currentY === null || Math.abs(y - currentY) > height * 0.5) {
      flush();
      currentY = y;
      currentHeight = height;
    }
    if (item.str.trim()) currentParts.push({ x: item.transform[4], text: item.str });
  }
  flush();

  const nonEmpty = lines.filter((l) => l.text);
  if (nonEmpty.length === 0) return [];

  const heights = nonEmpty.map((l) => l.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 10;

  const blocks: Block[] = [];
  let paragraphLines: string[] = [];
  let prevY: number | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ kind: "paragraph", runs: [{ text: paragraphLines.join(" ") }] });
    paragraphLines = [];
  };

  for (const line of nonEmpty) {
    const gap = prevY === null ? 0 : prevY - line.y;
    const isHeading = line.height > medianHeight * 1.3;

    if (prevY !== null && gap > line.height * 1.6) flushParagraph();

    if (isHeading) {
      flushParagraph();
      const level = line.height > medianHeight * 1.8 ? 1 : 2;
      blocks.push({ kind: "heading", level, runs: [{ text: line.text }] });
    } else {
      paragraphLines.push(line.text);
    }
    prevY = line.y;
  }
  flushParagraph();

  return blocks;
}

/** Splits OCR'd plain text into paragraph blocks — no heading/position
 * heuristics for the OCR path, since Tesseract's per-word boxes are noisier
 * than a real text layer's; a scanned page becomes one or more flowing
 * paragraphs, split on blank lines. */
function ocrTextToBlocks(text: string): Block[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((text) => ({ kind: "paragraph" as const, runs: [{ text }] }));
}

export async function loadPdfPages(bytes: ArrayBuffer, onProgress?: (done: number, total: number) => void): Promise<PdfPage[]> {
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages: PdfPage[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported.");
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const thumbnailUrl = canvas.toDataURL("image/png");

    const textContent = await page.getTextContent();
    const textItems = textContent.items.filter(isTextItem);
    const totalChars = textItems.reduce((sum, it) => sum + it.str.trim().length, 0);

    let blocks: Block[];
    let usedOcr = false;
    if (totalChars > 20) {
      blocks = textItemsToBlocks(textItems);
    } else {
      // Empty/near-empty text layer — scanned or image-only page. Fall back
      // to client-side OCR on the rendered page image.
      usedOcr = true;
      const ocrText = await ocrImage(thumbnailUrl);
      blocks = ocrTextToBlocks(ocrText);
    }

    pages.push({ blocks, thumbnailUrl, usedOcr });
    onProgress?.(pageNum, doc.numPages);
  }

  return pages;
}
