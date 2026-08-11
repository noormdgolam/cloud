"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/storage";
import { getAnonId } from "@/lib/anon-session";

const nameSchema = z.string().trim().min(1, "Name can't be empty.").max(255);

type Identity = { userId: string } | { anonymousSessionId: string };

async function requireIdentity(): Promise<Identity> {
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id };

  const anonId = await getAnonId();
  if (anonId) return { anonymousSessionId: anonId };

  throw new Error("Could not identify session.");
}

function ownsFile(file: { userId: string | null; anonymousSessionId: string | null }, identity: Identity) {
  return "userId" in identity
    ? file.userId === identity.userId
    : file.anonymousSessionId === identity.anonymousSessionId;
}

export async function renameFile(fileId: string, formData: FormData) {
  const identity = await requireIdentity();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return;

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || !ownsFile(file, identity)) throw new Error("Not found.");

  await prisma.file.update({
    where: { id: fileId },
    data: { originalName: parsed.data },
  });

  revalidatePath(file.folderId ? `/folder/${file.folderId}` : "/dashboard");
  revalidatePath("/upload");
}

export async function listUserFolders(): Promise<{ id: string; name: string; parentId: string | null }[]> {
  const identity = await requireIdentity();
  if (!("userId" in identity)) return []; // anonymous visitors have no folders

  return prisma.folder.findMany({
    where: { userId: identity.userId },
    select: { id: true, name: true, parentId: true },
    orderBy: { name: "asc" },
  });
}

export async function moveFile(fileId: string, targetFolderId: string | null) {
  const identity = await requireIdentity();

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || !ownsFile(file, identity)) throw new Error("Not found.");

  if (targetFolderId) {
    const folder = await prisma.folder.findUnique({ where: { id: targetFolderId } });
    if (!folder || !ownsFile(folder, identity)) throw new Error("Folder not found.");
  }

  await prisma.file.update({ where: { id: fileId }, data: { folderId: targetFolderId } });

  revalidatePath(file.folderId ? `/folder/${file.folderId}` : "/dashboard");
  revalidatePath(targetFolderId ? `/folder/${targetFolderId}` : "/dashboard");
}

export async function deleteFile(fileId: string) {
  const identity = await requireIdentity();

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || !ownsFile(file, identity)) throw new Error("Not found.");

  // Release the DB row + quota first; if disk cleanup fails, an orphaned
  // blob just wastes disk (recoverable), whereas the reverse order could
  // leave a File row pointing at bytes that no longer exist.
  await prisma.$transaction(async (tx) => {
    if ("userId" in identity) {
      await tx.user.update({
        where: { id: identity.userId },
        data: { usedBytes: { decrement: file.size } },
      });
    } else {
      await tx.anonymousSession.update({
        where: { id: identity.anonymousSessionId },
        data: { usedBytes: { decrement: file.size } },
      });
    }
    await tx.file.delete({ where: { id: fileId } });
  });

  await deleteStoredFile(file.storageKey).catch((error) => {
    console.error("Failed to remove stored file from disk:", file.storageKey, error);
  });

  revalidatePath(file.folderId ? `/folder/${file.folderId}` : "/dashboard");
  revalidatePath("/upload");
}
