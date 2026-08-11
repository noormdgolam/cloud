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

export async function listUserFoldersForMove(
  excludeSubtreeOf: string
): Promise<{ id: string; name: string; parentId: string | null }[]> {
  const userId = await requireUserId();
  const all = await prisma.folder.findMany({
    where: { userId },
    select: { id: true, name: true, parentId: true },
    orderBy: { name: "asc" },
  });

  // A folder can't move into itself or any of its own descendants — walk
  // down from the folder being moved to find every id that's off-limits.
  const excluded = new Set<string>([excludeSubtreeOf]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of all) {
      if (f.parentId && excluded.has(f.parentId) && !excluded.has(f.id)) {
        excluded.add(f.id);
        grew = true;
      }
    }
  }

  return all.filter((f) => !excluded.has(f.id));
}

export async function moveFolder(folderId: string, targetParentId: string | null) {
  const userId = await requireUserId();

  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder || folder.userId !== userId) throw new Error("Not found.");

  if (targetParentId) {
    if (targetParentId === folderId) throw new Error("Can't move a folder into itself.");
    const target = await prisma.folder.findUnique({ where: { id: targetParentId } });
    if (!target || target.userId !== userId) throw new Error("Folder not found.");

    // Defense in depth against the same self-nesting problem
    // listUserFoldersForMove already filters out of the picker — walk up
    // from the target to make sure it isn't a descendant of the folder
    // being moved.
    let cursor: string | null = target.parentId;
    while (cursor) {
      if (cursor === folderId) throw new Error("Can't move a folder into its own subfolder.");
      const parent: { parentId: string | null } | null = await prisma.folder.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }

  await prisma.folder.update({ where: { id: folderId }, data: { parentId: targetParentId } });

  revalidatePath(folder.parentId ? `/folder/${folder.parentId}` : "/dashboard");
  revalidatePath(targetParentId ? `/folder/${targetParentId}` : "/dashboard");
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
