"use client";

import { PDFDocument, degrees, rgb } from "pdf-lib";

export async function getPageCount(bytes: ArrayBuffer): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

export async function rotatePdf(bytes: ArrayBuffer, rotateBy: 90 | 180 | 270): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  for (const page of doc.getPages()) {
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + rotateBy) % 360));
  }
  return doc.save();
}

// pageNumbers is 1-indexed (matching how they're shown in the UI) and may
// include ranges already expanded by the caller.
export async function extractPages(bytes: ArrayBuffer, pageNumbers: number[]): Promise<Uint8Array> {
  const source = await PDFDocument.load(bytes);
  const output = await PDFDocument.create();
  const indices = pageNumbers.map((n) => n - 1);
  const copied = await output.copyPages(source, indices);
  for (const page of copied) output.addPage(page);
  return output.save();
}

export async function addWatermark(bytes: ArrayBuffer, text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont("Helvetica");
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const fontSize = Math.min(width, height) / 10;
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: height / 2,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.3,
      rotate: degrees(45),
    });
  }
  return doc.save();
}

// Structural compression only (deduplicated object streams, stripped
// unused objects) — pdf-lib doesn't expose a way to re-encode embedded
// images at lower quality, so this helps most on text/vector-heavy PDFs
// with redundant objects and does little for already-image-heavy ones.
// The UI is upfront about this rather than overpromising.
export async function compressPdf(bytes: ArrayBuffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  return doc.save({ useObjectStreams: true });
}

export async function mergePdfs(buffers: ArrayBuffer[]): Promise<Uint8Array> {
  const output = await PDFDocument.create();
  for (const buffer of buffers) {
    const source = await PDFDocument.load(buffer);
    const copied = await output.copyPages(source, source.getPageIndices());
    for (const page of copied) output.addPage(page);
  }
  return output.save();
}

// Parses "1-3,5,8-10" into [1,2,3,5,8,9,10], clamped to [1, pageCount] and
// deduped while preserving first-seen order.
export function parsePageRanges(input: string, pageCount: number): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const part of input.split(",").map((s) => s.trim()).filter(Boolean)) {
    const rangeMatch = /^(\d+)-(\d+)$/.exec(part);
    if (rangeMatch) {
      const start = Math.max(1, Number(rangeMatch[1]));
      const end = Math.min(pageCount, Number(rangeMatch[2]));
      for (let n = start; n <= end; n++) {
        if (!seen.has(n)) {
          seen.add(n);
          result.push(n);
        }
      }
    } else if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (n >= 1 && n <= pageCount && !seen.has(n)) {
        seen.add(n);
        result.push(n);
      }
    }
  }
  return result;
}
