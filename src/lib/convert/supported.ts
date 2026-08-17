// Pure, dependency-free logic shared between the server action (which needs
// it to pick a ConvertAPI pipeline) and client components (which need it to
// decide what "Convert to..." options to show) — kept out of the
// "use server" actions file since every export there must be async.

export function sourceConvertExt(originalName: string, mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("wordprocessingml")) return "docx";
  if (mimeType.includes("spreadsheetml") || mimeType === "application/vnd.ms-excel") return "xlsx";
  if (mimeType.startsWith("image/")) return mimeType.split("/")[1];
  const dot = originalName.lastIndexOf(".");
  return dot === -1 ? "" : originalName.slice(dot + 1).toLowerCase();
}

export function supportedConversions(originalName: string, mimeType: string): string[] {
  const ext = sourceConvertExt(originalName, mimeType);
  if (ext === "docx") return ["pdf"];
  if (ext === "xlsx") return ["pdf"];
  if (ext === "pdf") return ["docx"];
  if (ext === "jpg" || ext === "jpeg" || ext === "png") return ["pdf"];
  return [];
}
