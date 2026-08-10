import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { reserveQuota, QuotaExceededError } from "@/lib/quota";
import { resolveIdentity, ownsRecord } from "@/lib/identity";
import { ensureAnonymousSession } from "@/lib/anon-session";
import { checkRateLimit, getClientIp, RateLimitExceededError } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  totalSize: z.number().int().positive(),
  folderId: z.string().nullable().optional(),
});

// Files this large only make sense via the chunked path — keep a sane
// ceiling so a single account can't reserve an absurd amount in one call.
const MAX_CHUNKED_BYTES = 5 * 1024 * 1024 * 1024; // 5 GiB

export async function POST(request: NextRequest) {
  const identity = await resolveIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Could not identify session." }, { status: 400 });
  }

  try {
    await checkRateLimit(`${getClientIp(request)}:upload-init:${"userId" in identity ? "auth" : "anon"}`, {
      limit: "userId" in identity ? 60 : 20,
      windowMs: 10 * 60 * 1000,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json({ error: "Too many uploads. Try again shortly." }, { status: 429 });
    }
    throw error;
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { filename, mimeType, totalSize, folderId } = parsed.data;

  if (totalSize > MAX_CHUNKED_BYTES) {
    return NextResponse.json({ error: "File exceeds the maximum upload size." }, { status: 413 });
  }

  const resolvedFolderId = "userId" in identity ? (folderId ?? null) : null;
  if (resolvedFolderId) {
    const folder = await prisma.folder.findUnique({ where: { id: resolvedFolderId } });
    if (!folder || !ownsRecord(folder, identity)) {
      return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    }
  }

  if ("anonymousSessionId" in identity) {
    await ensureAnonymousSession(identity.anonymousSessionId);
  }

  try {
    const reserved = await reserveQuota(identity, BigInt(totalSize), {
      originalName: filename,
      mimeType,
      folderId: resolvedFolderId,
    });
    return NextResponse.json({ uploadId: reserved.id });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({ error: "Storage quota exceeded." }, { status: 413 });
    }
    console.error("upload/init failed:", error);
    return NextResponse.json({ error: "Could not start upload." }, { status: 500 });
  }
}
