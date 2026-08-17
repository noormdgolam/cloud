"use client";

import { PDFDocument } from "pdf-lib";

export type Point = { x: number; y: number };

export function defaultCorners(w: number, h: number): [Point, Point, Point, Point] {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}

export function pointDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Solves the 8-unknown linear system for the 3x3 homography (h33 fixed to 1)
// mapping `from` -> `to` over 4 point correspondences. Gaussian elimination
// with partial pivoting for numerical stability — the corner points a user
// drags can be nearly collinear, which makes a naive solve blow up.
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
    }
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];

    const pivotVal = M[col][col];
    if (Math.abs(pivotVal) < 1e-12) continue; // degenerate (collinear points) — best effort

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / pivotVal;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }

  return M.map((row, i) => (row[i] === 0 ? 0 : row[n] / row[i]));
}

// h = [h11,h12,h13, h21,h22,h23, h31,h32] (h33 = 1 by convention)
function computeHomography(from: Point[], to: Point[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: X, y: Y } = to[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  return solveLinearSystem(A, b);
}

function applyHomography(h: number[], x: number, y: number): Point {
  const [h11, h12, h13, h21, h22, h23, h31, h32] = h;
  const w = h31 * x + h32 * y + 1;
  return { x: (h11 * x + h12 * y + h13) / w, y: (h21 * x + h22 * y + h23) / w };
}

function bilinearSample(img: ImageData, x: number, y: number): [number, number, number, number] {
  const { width, height, data } = img;
  const sample = (xx: number, yy: number): [number, number, number, number] => {
    const i = (yy * width + xx) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };

  if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) {
    const cx = Math.max(0, Math.min(width - 1, Math.round(x)));
    const cy = Math.max(0, Math.min(height - 1, Math.round(y)));
    return sample(cx, cy);
  }

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const p00 = sample(x0, y0);
  const p10 = sample(x0 + 1, y0);
  const p01 = sample(x0, y0 + 1);
  const p11 = sample(x0 + 1, y0 + 1);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    out[c] = lerp(lerp(p00[c], p10[c], fx), lerp(p01[c], p11[c], fx), fy);
  }
  return out;
}

/**
 * Warps the quadrilateral `corners` (in source-image pixel space, order
 * top-left/top-right/bottom-right/bottom-left) into a flat outW×outH
 * rectangle — the actual "make a skewed photo of a page look scanned"
 * operation. Computes the homography from the OUTPUT rectangle to the
 * source quad (not the other way around) so sampling can inverse-map each
 * destination pixel directly, which is what avoids gaps in the output that
 * a forward warp would leave.
 */
export function warpPerspective(
  source: HTMLImageElement | HTMLCanvasElement,
  corners: [Point, Point, Point, Point],
  outW: number,
  outH: number
): HTMLCanvasElement {
  const sw = "naturalWidth" in source ? source.naturalWidth : source.width;
  const sh = "naturalHeight" in source ? source.naturalHeight : source.height;

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = sw;
  srcCanvas.height = sh;
  const sctx = srcCanvas.getContext("2d")!;
  sctx.drawImage(source, 0, 0);
  const srcData = sctx.getImageData(0, 0, sw, sh);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const octx = outCanvas.getContext("2d")!;
  const outData = octx.createImageData(outW, outH);

  const rect: Point[] = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ];
  const h = computeHomography(rect, corners);

  for (let Y = 0; Y < outH; Y++) {
    for (let X = 0; X < outW; X++) {
      const { x: sx, y: sy } = applyHomography(h, X, Y);
      const [r, g, b, a] = bilinearSample(srcData, sx, sy);
      const idx = (Y * outW + X) * 4;
      outData.data[idx] = r;
      outData.data[idx + 1] = g;
      outData.data[idx + 2] = b;
      outData.data[idx + 3] = a;
    }
  }
  octx.putImageData(outData, 0, 0);
  return outCanvas;
}

export function applyGrayscale(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d")!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = lum;
  }
  ctx.putImageData(img, 0, 0);
}

// Otsu's method: finds the threshold that best splits the luminance
// histogram into two classes (page background vs. ink) — an automatic
// choice rather than a fixed magic number, since lighting varies a lot.
function otsuThreshold(hist: number[], total: number): number {
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 127;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }
  return threshold;
}

export function applyScanBW(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d")!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const pixelCount = d.length / 4;
  const lums = new Uint8ClampedArray(pixelCount);
  const hist = new Array(256).fill(0);

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const lum = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    lums[p] = lum;
    hist[lum]++;
  }

  const threshold = otsuThreshold(hist, pixelCount);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = lums[p] > threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

// "Magic Color" — per-channel auto-levels (stretch each channel's actual
// min/max to the full 0-255 range), the classic scan-app trick for turning
// a dim/yellow-cast photo of a page into one with a clean white background.
export function applyMagicColor(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d")!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;

  let minR = 255,
    maxR = 0,
    minG = 255,
    maxG = 0,
    minB = 255,
    maxB = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < minR) minR = d[i];
    if (d[i] > maxR) maxR = d[i];
    if (d[i + 1] < minG) minG = d[i + 1];
    if (d[i + 1] > maxG) maxG = d[i + 1];
    if (d[i + 2] < minB) minB = d[i + 2];
    if (d[i + 2] > maxB) maxB = d[i + 2];
  }

  const stretch = (v: number, min: number, max: number) =>
    max > min ? Math.max(0, Math.min(255, ((v - min) / (max - min)) * 255)) : v;

  for (let i = 0; i < d.length; i += 4) {
    d[i] = stretch(d[i], minR, maxR);
    d[i + 1] = stretch(d[i + 1], minG, maxG);
    d[i + 2] = stretch(d[i + 2], minB, maxB);
  }
  ctx.putImageData(img, 0, 0);
}

const PDF_DPI = 150;

/**
 * Combines processed page canvases into a single PDF, one page per canvas,
 * each PDF page sized to match that canvas's own pixel dimensions (at
 * PDF_DPI) so there's no letterboxing or stretching.
 */
export async function imagesToPdf(
  pages: { canvas: HTMLCanvasElement; mime: "image/jpeg" | "image/png" }[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  for (const page of pages) {
    const blob = await new Promise<Blob>((resolve, reject) => {
      page.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), page.mime, 0.9);
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const image = page.mime === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

    const widthPt = (page.canvas.width / PDF_DPI) * 72;
    const heightPt = (page.canvas.height / PDF_DPI) * 72;
    const pdfPage = doc.addPage([widthPt, heightPt]);
    pdfPage.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt });
  }

  return doc.save();
}
