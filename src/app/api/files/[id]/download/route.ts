import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFileReadStream } from "@/lib/storage";
import { isPreviewableServerSide } from "@/lib/mime-preview";
import { ANON_HEADER_NAME } from "@/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/files/[id]/download">) {
  const session = await auth();
  const userId = session?.user?.id;
  const anonId = request.headers.get(ANON_HEADER_NAME);

  const { id } = await ctx.params;
  const file = await prisma.file.findUnique({ where: { id } });

  const owns = userId
    ? file?.userId === userId
    : anonId
      ? file?.anonymousSessionId === anonId
      : false;

  if (!file || !owns || file.status !== "COMMITTED") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (file.scanStatus === "INFECTED") {
    return NextResponse.json(
      { error: "This file was flagged as malicious by a virus scan and can't be downloaded." },
      { status: 403 }
    );
  }

  const totalSize = Number(file.size);
  const rangeHeader = request.headers.get("range");

  // Inline viewing is only ever honored for types that can't carry an
  // active-content risk when rendered directly in this origin — SVG is
  // deliberately excluded from "image/*" since it can embed scripts, and
  // there's no CSP here to sandbox that. text/* is served inline as plain
  // text (browsers don't execute text/plain), never text/html. Checked
  // server-side (not just hidden in the UI) so requesting ?inline=1 on a
  // disallowed type can't bypass it.
  const previewable = isPreviewableServerSide(file.mimeType);
  const wantsInline = request.nextUrl.searchParams.get("inline") === "1" && previewable;

  const headers = new Headers({
    "Content-Type": file.mimeType || "application/octet-stream",
    "Content-Disposition": wantsInline
      ? `inline; filename="${encodeURIComponent(file.originalName)}"`
      : `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  });

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
