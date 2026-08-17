import { prisma } from "@/lib/prisma";

export type BreadcrumbEntry = { id: string; name: string };
export type FileScanStatus = "PENDING" | "CLEAN" | "INFECTED" | "ERROR" | "SKIPPED";

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

export type TrashedFile = {
  id: string;
  originalName: string;
  size: bigint;
  mimeType: string;
  deletedAt: Date | null;
};

export async function getTrashedFiles(userId: string): Promise<TrashedFile[]> {
  const files = await prisma.file.findMany({
    where: { userId, status: "DELETED" },
    orderBy: { deletedAt: "desc" },
  });

  return files.map((file) => ({
    id: file.id,
    originalName: file.originalName,
    size: file.size,
    mimeType: file.mimeType,
    deletedAt: file.deletedAt,
  }));
}

export type SortOption = "date" | "name" | "size";

const FILE_ORDER_BY: Record<SortOption, { createdAt: "desc" } | { originalName: "asc" } | { size: "desc" }> = {
  date: { createdAt: "desc" },
  name: { originalName: "asc" },
  size: { size: "desc" },
};

export async function getFolderContents(userId: string, folderId: string | null, sort: SortOption = "date") {
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

  const [folders, files, duplicateGroups] = await Promise.all([
    prisma.folder.findMany({
      where: { userId, parentId: folderId },
      orderBy: { name: "asc" },
    }),
    prisma.file.findMany({
      where: { userId, folderId, status: "COMMITTED" },
      orderBy: FILE_ORDER_BY[sort],
      // Explicit select — this result goes straight to a client component
      // (FileBrowser/FileRow/FileTile), so it must never carry internal-only
      // fields (storageKey, anonymousSessionId, viewCount, etc.) across the
      // server/client boundary.
      select: {
        id: true,
        originalName: true,
        size: true,
        mimeType: true,
        createdAt: true,
        folderId: true,
        checksumSha256: true,
        scanStatus: true,
      },
    }),
    // Duplicate detection scans the user's whole library (not just this
    // folder) — two copies of the same file are still duplicates even if
    // filed under different folders.
    prisma.file.groupBy({
      by: ["checksumSha256"],
      where: { userId, status: "COMMITTED", checksumSha256: { not: null } },
      _count: true,
      having: { checksumSha256: { _count: { gt: 1 } } },
    }),
  ]);

  const duplicateChecksums = new Set(duplicateGroups.map((g) => g.checksumSha256));
  const filesWithDuplicateFlag = files.map((file) => ({
    ...file,
    isDuplicate: file.checksumSha256 !== null && duplicateChecksums.has(file.checksumSha256),
  }));

  return { breadcrumbs, folders, files: filesWithDuplicateFlag };
}
