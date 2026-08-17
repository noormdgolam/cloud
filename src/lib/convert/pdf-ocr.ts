"use client";

// Thin tesseract.js wrapper — fully client-side WASM OCR, no server call, no
// document bytes ever leave the browser. Worker/core-wasm/language data all
// fetch from tesseract.js's default jsdelivr CDN at runtime (confirmed via
// its own source: workerPath/corePath/langPath all default to
// cdn.jsdelivr.net unless explicitly overridden) — never self-hosted, so
// this never adds to the app's own build/deploy payload, only a one-time
// runtime fetch the first time a user actually OCRs a page.
export async function ocrImage(imageDataUrl: string): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(imageDataUrl);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}
