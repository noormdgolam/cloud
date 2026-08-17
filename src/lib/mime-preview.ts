// Single source of truth for which mimetypes get inline preview instead of
// a forced download — shared between the server-side enforcement in the
// download route and the client-side UI that decides whether to open a
// preview dialog vs. trigger a download.
export type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "docx" | "xlsx";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel", // legacy .xls — SheetJS parses both formats
]);

// text/html (and the XHTML variant) are deliberately excluded even though
// they match the "text/" prefix — Content-Disposition: inline for those
// would have the browser render and execute them same-origin, a stored-XSS
// vector via an uploaded .html file. There's no CSP here to sandbox that.
const TEXT_MIME_EXCLUDED = new Set(["text/html", "application/xhtml+xml"]);
const TEXT_MIME_EXACT = new Set([
  "application/json",
  "application/javascript",
  "application/typescript",
  "application/xml",
  "application/x-yaml",
  "application/x-sh",
]);

export function previewKind(mimeType: string): PreviewKind | null {
  // SVG excluded from "image/*" — it can embed scripts, and there's no CSP
  // here to sandbox that.
  if (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === DOCX_MIME) return "docx";
  if (XLSX_MIMES.has(mimeType)) return "xlsx";
  if (TEXT_MIME_EXCLUDED.has(mimeType)) return null;
  if (mimeType.startsWith("text/") || TEXT_MIME_EXACT.has(mimeType)) return "text";
  return null;
}

export function isPreviewableServerSide(mimeType: string): boolean {
  return previewKind(mimeType) !== null;
}
