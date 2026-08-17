import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createFileReadStream } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const inline = request.nextUrl.searchParams.get("inline") === "1";
  const disposition = inline ? "inline" : `attachment; filename="${encodeURIComponent(file.originalName)}"`;

  const headers = new Headers({
    "Content-Type": file.mimeType || "application/octet-stream",
    "Content-Disposition": disposition,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Content-Length": String(file.size),
  });

  const nodeStream = createFileReadStream(file.storageKey);
  const webStream = Readable.toWeb(nodeStream) as unknown as NodeWebReadableStream;
  return new NextResponse(webStream as unknown as BodyInit, { status: 200, headers });
}
