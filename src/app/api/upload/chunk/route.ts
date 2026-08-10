import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeUploadChunk } from "@/lib/storage";
import { resolveIdentity, ownsRecord } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHUNK_BYTES = 16 * 1024 * 1024; // generous headroom over the client's ~8MB slices

export async function POST(request: NextRequest) {
  const identity = await resolveIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Could not identify session." }, { status: 400 });
  }

  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId");
  const chunkIndex = Number(url.searchParams.get("chunkIndex"));

  if (!uploadId || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: "Invalid chunk request." }, { status: 400 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!contentLength || contentLength > MAX_CHUNK_BYTES) {
    return NextResponse.json({ error: "Invalid chunk size." }, { status: 413 });
  }

  const file = await prisma.file.findUnique({ where: { id: uploadId } });
  if (!file || !ownsRecord(file, identity) || file.status !== "RESERVED") {
    return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  }

  if (!request.body) {
    return NextResponse.json({ error: "Empty chunk." }, { status: 400 });
  }

  try {
    const nodeStream = Readable.fromWeb(request.body as import("node:stream/web").ReadableStream);
    const size = await writeUploadChunk(uploadId, chunkIndex, nodeStream);
    return NextResponse.json({ ok: true, size });
  } catch (error) {
    console.error("upload/chunk failed:", error);
    return NextResponse.json({ error: "Chunk upload failed." }, { status: 500 });
  }
}
