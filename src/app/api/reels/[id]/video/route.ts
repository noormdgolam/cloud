import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createFileReadStream } from "@/lib/storage";
import { checkRateLimit, getClientIp, RateLimitExceededError } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fully public streaming for a published reel's video bytes — no ownership
// check, gated purely on Reel.published, mirroring /api/s/[token]'s
// "nothing about validity is assumed from a prior request" stance.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/reels/[id]/video">) {
  try {
    await checkRateLimit(`${getClientIp(request)}:reel-video`, { limit: 120, windowMs: 10 * 60 * 1000 });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Too many requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    throw error;
  }

  const { id } = await ctx.params;
  const reel = await prisma.reel.findUnique({ where: { id }, include: { file: true } });

  if (!reel || !reel.published || reel.file.status !== "COMMITTED") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const file = reel.file;
  const totalSize = Number(file.size);

  const headers = new Headers({
    "Content-Type": file.mimeType || "video/mp4",
    "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
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
