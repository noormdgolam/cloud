import { prisma } from "@/lib/prisma";

export type BreadcrumbEntry = { id: string; name: string };

export type SearchResultFile = {
  id: string;
  originalName: string;
  size: bigint;
  mimeType: string;
  createdAt: Date;
  folderId: string | null;
  folderName: string | null;
};

export async function searchFiles(userId: string, query: string): Promise<SearchResultFile[]> {
  const files = await prisma.file.findMany({
    where: { userId, status: "COMMITTED", originalName: { contains: query } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { folder: { select: { name: true } } },
  });

  return files.map((file) => ({
    id: file.id,
    originalName: file.originalName,
    size: file.size,
    mimeType: file.mimeType,
    createdAt: file.createdAt,
    folderId: file.folderId,
    folderName: file.folder?.name ?? null,
  }));
}

export async function getFolderContents(userId: string, folderId: string | null) {
  let breadcrumbs: BreadcrumbEntry[] = [];

  if (folderId) {
    const current = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!current || current.userId !== userId) {
      return null;
    }

    breadcrumbs = [{ id: current.id, name: current.name }];
    let cursor = current.parentId;
    while (cursor) {
      const parent: { id: string; name: string; parentId: string | null } | null =
        await prisma.folder.findUnique({
          where: { id: cursor },
          select: { id: true, name: true, parentId: true },
        });
      if (!parent) break;
      breadcrumbs.unshift({ id: parent.id, name: parent.name });
      cursor = parent.parentId;
    }
  }

  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: { userId, parentId: folderId },
      orderBy: { name: "asc" },
    }),
    prisma.file.findMany({
      where: { userId, folderId, status: "COMMITTED" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { breadcrumbs, folders, files };
}
