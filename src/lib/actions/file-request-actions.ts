"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in.");
  return session.user.id;
}

export async function createFileRequest(formData: FormData) {
  const userId = await requireUserId();

  const title = String(formData.get("title") ?? "").trim().slice(0, 191);
  if (!title) throw new Error("Title is required.");

  const message = String(formData.get("message") ?? "").trim().slice(0, 2000) || null;
  const folderId = String(formData.get("folderId") ?? "") || null;
  const maxFilesRaw = String(formData.get("maxFiles") ?? "").trim();
  const maxFiles = maxFilesRaw ? Math.max(1, Math.min(500, Number(maxFilesRaw) || 0)) || null : null;
  const expiresInDaysRaw = String(formData.get("expiresInDays") ?? "").trim();
  const expiresAt = expiresInDaysRaw
    ? new Date(Date.now() + Number(expiresInDaysRaw) * 24 * 60 * 60 * 1000)
    : null;

  if (folderId) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== userId) throw new Error("Folder not found.");
  }

  const token = randomBytes(18).toString("base64url");

  await prisma.fileRequest.create({
    data: { token, userId, title, message, folderId, maxFiles, expiresAt },
  });

  revalidatePath("/requests");
}

export async function revokeFileRequest(id: string) {
  const userId = await requireUserId();
  const request = await prisma.fileRequest.findUnique({ where: { id } });
  if (!request || request.userId !== userId) throw new Error("Not found.");

  await prisma.fileRequest.update({ where: { id }, data: { revoked: true } });
  revalidatePath("/requests");
}

export async function deleteFileRequest(id: string) {
  const userId = await requireUserId();
  const request = await prisma.fileRequest.findUnique({ where: { id } });
  if (!request || request.userId !== userId) throw new Error("Not found.");

  // Only removes the request record itself — files already received through
  // it are ordinary files in the user's own storage now and are untouched.
  await prisma.fileRequest.delete({ where: { id } });
  revalidatePath("/requests");
}
