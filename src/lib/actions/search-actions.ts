"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated.");
  return userId;
}

export type PaletteFile = { id: string; name: string; folderId: string | null };
export type PaletteFolder = { id: string; name: string };

export async function searchForPalette(query: string): Promise<{ files: PaletteFile[]; folders: PaletteFolder[] }> {
  const userId = await requireUserId();
  const trimmed = query.trim();
  if (!trimmed) return { files: [], folders: [] };

  const [files, folders] = await Promise.all([
    prisma.file.findMany({
      where: { userId, status: "COMMITTED", originalName: { contains: trimmed } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, originalName: true, folderId: true },
    }),
    prisma.folder.findMany({
      where: { userId, name: { contains: trimmed } },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, name: true },
    }),
  ]);

  return {
    files: files.map((f) => ({ id: f.id, name: f.originalName, folderId: f.folderId })),
    folders: folders.map((f) => ({ id: f.id, name: f.name })),
  };
}
