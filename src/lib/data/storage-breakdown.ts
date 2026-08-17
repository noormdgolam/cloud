import { prisma } from "@/lib/prisma";

// Fixed category -> hue-slot order (never cycled, never re-derived from
// data) — matches the dataviz skill's validated 6-slot categorical palette.
export const STORAGE_CATEGORIES = ["images", "videos", "audio", "documents", "archives", "other"] as const;
export type StorageCategory = (typeof STORAGE_CATEGORIES)[number];

function categorize(mimeType: string): StorageCategory {
  if (mimeType.startsWith("image/")) return "images";
  if (mimeType.startsWith("video/")) return "videos";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("application/zip") || mimeType.includes("compressed") || mimeType.includes("archive")) {
    return "archives";
  }
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.includes("word") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("presentation") ||
    mimeType === "application/json"
  ) {
    return "documents";
  }
  return "other";
}

export async function getStorageBreakdown(userId: string): Promise<{ category: StorageCategory; bytes: bigint }[]> {
  // Only mimeType/size pulled per row (not full File records) — keeps this
  // lightweight even for accounts with many thousands of files.
  const files = await prisma.file.findMany({
    where: { userId, status: "COMMITTED" },
    select: { mimeType: true, size: true },
  });

  const totals = new Map<StorageCategory, bigint>();
  for (const file of files) {
    const category = categorize(file.mimeType);
    totals.set(category, (totals.get(category) ?? BigInt(0)) + file.size);
  }

  return STORAGE_CATEGORIES.map((category) => ({ category, bytes: totals.get(category) ?? BigInt(0) })).filter(
    (row) => row.bytes > BigInt(0)
  );
}
