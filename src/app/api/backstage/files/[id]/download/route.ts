import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createFileReadStream } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Strict allowlist for inline rendering: images (excluding scriptable SVG), video, audio, and PDF.
// Client-supplied mimeType is untrusted at upload time, so direct navigation or raw view must
// never render attacker-controlled HTML/SVG same-origin in an active admin session.
function isSafeInlineMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  if (mime === "image/svg+xml" || mime.includes("html") || mime.includes("script") || mime.includes("xml")) {
    return false;
  }
  return (
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/") ||
    mime === "application/pdf"
  );
}

// God-mode download — no ownership check, any admin can pull any file.
// requireAdmin() itself 404s a non-admin rather than 401/403, same reasoning
// as the rest of /backstage: never confirm this route exists to someone who
// shouldn't know it does.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/backstage/files/[id]/download">) {
  await requireAdmin();

  const { id } = await ctx.params;
  const file = await prisma.file.findUnique({ where: { id } });
  // RESERVED means the upload never finished — nothing real on disk yet.
  // COMMITTED/DELETED/PURGED all have real bytes on disk, and an admin can
  // pull any of them regardless of what the owning user sees.
  if (!file || file.status === "RESERVED") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const wantsInline = request.nextUrl.searchParams.get("inline") === "1";
  const canInline = wantsInline && isSafeInlineMime(file.mimeType);
  const disposition = canInline ? "inline" : `attachment; filename="${encodeURIComponent(file.originalName)}"`;

  const headers = new Headers({
    "Content-Type": canInline ? (file.mimeType || "application/octet-stream") : "application/octet-stream",
    "Content-Disposition": disposition,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Content-Length": String(file.size),
  });

  const nodeStream = createFileReadStream(file.storageKey);
  const webStream = Readable.toWeb(nodeStream) as unknown as NodeWebReadableStream;
  return new NextResponse(webStream as unknown as BodyInit, { status: 200, headers });
}
