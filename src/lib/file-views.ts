import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // one counted view per visitor per file per day

/**
 * Counts a share-link page load toward File.viewCount — the basis for the
 * creator-earnings program — but only once per (file, IP) per day, so
 * refreshing the page (by the uploader or anyone else) can't inflate it.
 * Best-effort: any failure here should never break the share page itself.
 */
export async function recordFileView(fileId: string, ip: string): Promise<void> {
  try {
    const key = createHash("sha256").update(`${fileId}:${ip}`).digest("hex").slice(0, 40);
    const now = new Date();

    const existing = await prisma.fileViewDedup.findUnique({ where: { key } });
    if (existing && existing.expiresAt > now) return;

    await prisma.$transaction([
      prisma.fileViewDedup.upsert({
        where: { key },
        create: { key, expiresAt: new Date(now.getTime() + DEDUP_WINDOW_MS) },
        update: { expiresAt: new Date(now.getTime() + DEDUP_WINDOW_MS) },
      }),
      prisma.file.update({ where: { id: fileId }, data: { viewCount: { increment: 1 } } }),
    ]);
  } catch (error) {
    console.error("recordFileView failed:", error);
  }
}
