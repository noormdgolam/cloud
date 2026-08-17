import { prisma } from "@/lib/prisma";
import { type Identity, ownerWhere, ownsRecord } from "@/lib/identity";

export type ZipEntry = { storageKey: string; pathInZip: string };

// Renames on collision (e.g. two files named "photo.jpg" from different
// folders selected together) rather than silently overwriting one entry in
// the zip.
function dedupeName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 2;
  let candidate = `${base} (${i})${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${base} (${i})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

export async function collectFilesByIds(ids: string[], identity: Identity): Promise<ZipEntry[]> {
  const files = await prisma.file.findMany({
    where: { id: { in: ids }, status: "COMMITTED", scanStatus: { not: "INFECTED" }, ...ownerWhere(identity) },
  });

  const used = new Set<string>();
  return files.map((file) => ({ storageKey: file.storageKey, pathInZip: dedupeName(file.originalName, used) }));
}

// Walks the folder tree recursively, building zip paths that mirror the
// real folder structure (e.g. "Photos/Vacation/beach.jpg") rather than
// flattening everything to the top level.
export async function collectFolderRecursive(folderId: string, identity: Identity): Promise<ZipEntry[]> {
  const root = await prisma.folder.findUnique({ where: { id: folderId } });
  const owns = root && ownsRecord(root, identity);
  if (!root || !owns) return [];

  const entries: ZipEntry[] = [];
  const used = new Set<string>();

  async function walk(currentFolderId: string, prefix: string) {
    const [subfolders, files] = await Promise.all([
      prisma.folder.findMany({ where: { parentId: currentFolderId, ...ownerWhere(identity) } }),
      prisma.file.findMany({
        where: { folderId: currentFolderId, status: "COMMITTED", scanStatus: { not: "INFECTED" }, ...ownerWhere(identity) },
      }),
    ]);

    for (const file of files) {
      entries.push({ storageKey: file.storageKey, pathInZip: dedupeName(`${prefix}${file.originalName}`, used) });
    }
    for (const sub of subfolders) {
      await walk(sub.id, `${prefix}${sub.name}/`);
    }
  }

  await walk(folderId, `${root.name}/`);
  return entries;
}
