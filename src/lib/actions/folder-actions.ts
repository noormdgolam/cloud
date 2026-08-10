"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const nameSchema = z.string().trim().min(1, "Name can't be empty.").max(120);

async function requireUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Not authenticated.");
  }
  return userId;
}

export async function createFolder(parentId: string | null, formData: FormData) {
  const userId = await requireUserId();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return;

  if (parentId) {
    const parent = await prisma.folder.findUnique({ where: { id: parentId } });
    if (parent?.userId !== userId) throw new Error("Not found.");
  }

  await prisma.folder.create({
    data: { name: parsed.data, parentId, userId },
  });

  revalidatePath(parentId ? `/folder/${parentId}` : "/dashboard");
}

export async function renameFolder(folderId: string, formData: FormData) {
  const userId = await requireUserId();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return;

  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (folder?.userId !== userId) throw new Error("Not found.");

  await prisma.folder.update({
    where: { id: folderId },
    data: { name: parsed.data },
  });

  revalidatePath(folder.parentId ? `/folder/${folder.parentId}` : "/dashboard");
  revalidatePath(`/folder/${folderId}`);
}

export async function deleteFolder(folderId: string) {
  const userId = await requireUserId();

  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (folder?.userId !== userId) throw new Error("Not found.");

  // Direct child files are moved to root (File.folderId is onDelete: SetNull),
  // not deleted — removing a folder should never destroy file content.
  await prisma.folder.delete({ where: { id: folderId } });

  revalidatePath(folder.parentId ? `/folder/${folder.parentId}` : "/dashboard");
}
