import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assembleChunks, cleanupChunks, deleteStoredFile } from "@/lib/storage";
import { commitQuota, releaseQuota } from "@/lib/quota";
import { resolveIdentity, ownsRecord } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  uploadId: z.string().min(1),
  totalChunks: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const identity = await resolveIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Could not identify session." }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { uploadId, totalChunks } = parsed.data;

  const file = await prisma.file.findUnique({ where: { id: uploadId } });
  if (!file || !ownsRecord(file, identity) || file.status !== "RESERVED") {
    return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  }

  try {
    const { size, sha256 } = await assembleChunks(uploadId, totalChunks, file.storageKey);
    const committed = await commitQuota(uploadId, BigInt(size), sha256);

    return NextResponse.json({
      file: {
        id: committed.id,
        name: committed.originalName,
        size: committed.size.toString(),
        mimeType: committed.mimeType,
      },
    });
  } catch (error) {
    console.error("upload/complete failed:", error);
    await cleanupChunks(uploadId).catch(() => {});
    await deleteStoredFile(file.storageKey).catch(() => {});
    await releaseQuota(uploadId).catch(() => {});
    return NextResponse.json({ error: "Could not complete upload." }, { status: 500 });
  }
}
