"use server";

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { PDFDocument } from "pdf-lib";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/anon-session";
import { reserveQuota, commitQuota, releaseQuota } from "@/lib/quota";
import { ensureStorageDirFor, resolveStoragePath } from "@/lib/storage";
import { type Identity, ownsRecord } from "@/lib/identity";
import { convertFile as convertViaApi } from "@/lib/convert/convertapi";
import { sourceConvertExt } from "@/lib/convert/supported";
import { docxToPdf } from "@/lib/convert/docx-to-pdf";
import { xlsxToPdf } from "@/lib/convert/xlsx-to-pdf";

// jpg/png -> pdf never needs an external API — pdf-lib can embed a raster
// image onto a page entirely locally (same technique scan-tools.ts already
// uses client-side).
async function imageToPdfLocal(buffer: Buffer, mimeType: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const image = mimeType === "image/png" ? await doc.embedPng(buffer) : await doc.embedJpg(buffer);
  const page = doc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return Buffer.from(await doc.save());
}

// docx/xlsx -> pdf also run entirely locally now (mammoth/xlsx + pdf-lib,
// all already dependencies) — see docx-to-pdf.ts and xlsx-to-pdf.ts for the
// rendering approach and its deliberate scope (readable, not pixel-perfect).
// Only pdf -> docx still goes through ConvertAPI: turning a PDF back into a
// real editable Word document needs actual layout reconstruction, which
// isn't a reasonable local-only build.
async function convertLocallyIfPossible(fromExt: string, toExt: string, buffer: Buffer, mimeType: string): Promise<Buffer | null> {
  if (toExt === "pdf" && (fromExt === "jpg" || fromExt === "jpeg" || fromExt === "png")) {
    return imageToPdfLocal(buffer, mimeType);
  }
  if (fromExt === "docx" && toExt === "pdf") return docxToPdf(buffer);
  if (fromExt === "xlsx" && toExt === "pdf") return xlsxToPdf(buffer);
  return null;
}

async function requireIdentity(): Promise<Identity> {
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id };
  const anonId = await getAnonId();
  if (anonId) return { anonymousSessionId: anonId };
  throw new Error("Could not identify session.");
}

function ownsFile(file: { userId: string | null; anonymousSessionId: string | null }, identity: Identity) {
  return ownsRecord(file, identity);
}

const TARGET_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  png: "image/png",
};

export async function convertFile(fileId: string, toExt: string): Promise<{ newFileId: string }> {
  const identity = await requireIdentity();
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || !ownsFile(file, identity) || file.status !== "COMMITTED") {
    throw new Error("Not found.");
  }

  const fromExt = sourceConvertExt(file.originalName, file.mimeType);
  if (!fromExt) throw new Error("Unsupported source file type.");

  const sourceBuffer = await readFile(resolveStoragePath(file.storageKey));
  const local = await convertLocallyIfPossible(fromExt, toExt, sourceBuffer, file.mimeType);
  const buffer = local ?? (await convertViaApi(fromExt, toExt, sourceBuffer, file.originalName)).buffer;
  const size = BigInt(buffer.length);
  const mimeType = TARGET_MIME[toExt] ?? "application/octet-stream";
  const baseName = file.originalName.replace(/\.[^.]+$/, "");
  const newName = `${baseName}.${toExt}`;

  const reserved = await reserveQuota(identity, size, {
    originalName: newName,
    mimeType,
    folderId: file.folderId,
  });

  try {
    await ensureStorageDirFor(reserved.storageKey);
    await writeFile(resolveStoragePath(reserved.storageKey), buffer);
    const checksum = createHash("sha256").update(buffer).digest("hex");
    await commitQuota(reserved.id, size, checksum);
  } catch (error) {
    await releaseQuota(reserved.id).catch(() => {});
    throw error;
  }

  revalidatePath(file.folderId ? `/folder/${file.folderId}` : "/dashboard");
  return { newFileId: reserved.id };
}
