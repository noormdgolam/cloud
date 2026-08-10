import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createFileReadStream } from "@/lib/storage";
import { checkRateLimit, getClientIp, RateLimitExceededError } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fully public — no session of any kind is trusted here. Every check is
// re-run against the database on every request; nothing about validity is
// assumed from a prior request.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/s/[token]">) {
  try {
    await checkRateLimit(`${getClientIp(request)}:share-download`, {
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Too many requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    throw error;
  }

  const { token } = await ctx.params;

  const link = await prisma.shareLink.findUnique({ where: { token }, include: { file: true } });

  if (!link || link.revoked) {
    return NextResponse.json({ error: "This link is no longer available." }, { status: 404 });
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }
  if (link.maxDownloads !== null && link.downloadCount >= link.maxDownloads) {
    return NextResponse.json({ error: "This link has reached its download limit." }, { status: 410 });
  }
  if (link.file.status !== "COMMITTED") {
    return NextResponse.json({ error: "File not available." }, { status: 404 });
  }

  const file = link.file;
  const totalSize = Number(file.size);

  const headers = new Headers({
    "Content-Type": file.mimeType || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  });

  await prisma.shareLink.update({
    where: { id: link.id },
    data: { downloadCount: { increment: 1 } },
  });

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : totalSize - 1;

      if (start >= totalSize || end >= totalSize || start > end) {
        headers.set("Content-Range", `bytes */${totalSize}`);
        return new NextResponse(null, { status: 416, headers });
      }

      headers.set("Content-Range", `bytes ${start}-${end}/${totalSize}`);
      headers.set("Content-Length", String(end - start + 1));

      const nodeStream = createFileReadStream(file.storageKey, { start, end });
      const webStream = Readable.toWeb(nodeStream) as unknown as NodeWebReadableStream;
      return new NextResponse(webStream as unknown as BodyInit, { status: 206, headers });
    }
  }

  headers.set("Content-Length", String(totalSize));
  const nodeStream = createFileReadStream(file.storageKey);
  const webStream = Readable.toWeb(nodeStream) as unknown as NodeWebReadableStream;
  return new NextResponse(webStream as unknown as BodyInit, { status: 200, headers });
}
