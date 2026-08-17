"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/anon-session";

import { type Identity, ownerWhere, ownsRecord } from "@/lib/identity";
import { adjustOwnerUsedBytes } from "@/lib/quota";

const nameSchema = z.string().trim().min(1, "Name can't be empty.").max(255);

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

export type PickerFile = { id: string; name: string; mimeType: string; size: bigint; folderId: string | null };

// Backs the Tools page's file picker — anonymous visitors get their own
// files too (tools work the same for them), just no folder tree to browse.
export async function listFilesForPicker(): Promise<PickerFile[]> {
  const identity = await requireIdentity();

  const files = await prisma.file.findMany({
    where: {
      status: "COMMITTED",
      ...ownerWhere(identity),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, originalName: true, mimeType: true, size: true, folderId: true },
  });

  return files.map((f) => ({ id: f.id, name: f.originalName, mimeType: f.mimeType, size: f.size, folderId: f.folderId }));
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

export async function bulkMoveFiles(fileIds: string[], targetFolderId: string | null) {
  const identity = await requireIdentity();
  if (fileIds.length === 0) return;

  if (targetFolderId) {
    const folder = await prisma.folder.findUnique({ where: { id: targetFolderId } });
    if (!folder || !ownsFile(folder, identity)) throw new Error("Folder not found.");
  }

  const where = ownerWhere(identity);
  const { count } = await prisma.file.updateMany({
    where: { id: { in: fileIds }, ...where },
    data: { folderId: targetFolderId },
  });

  revalidatePath("/dashboard");
  revalidatePath(targetFolderId ? `/folder/${targetFolderId}` : "/dashboard");
  return count;
}

export async function bulkDeleteFiles(fileIds: string[]) {
  const identity = await requireIdentity();
  if (fileIds.length === 0) return;

  const where = ownerWhere(identity);

  // status: "COMMITTED" guard — without it, a stale client replaying a
  // delete on an already-trashed or already-purged file would reset
  // deletedAt (harmless) or resurrect a PURGED file back into the trash
  // (not harmless: it lets the user restore something meant to be gone).
  await prisma.file.updateMany({
    where: { id: { in: fileIds }, ...where, status: "COMMITTED" },
    data: { status: "DELETED", deletedAt: new Date() },
  });

  revalidatePath("/trash");
  revalidatePath("/dashboard");
  revalidatePath("/upload");
}

// Moves a file to trash rather than deleting it outright — the disk blob
// and quota usage are untouched (still "used" while trashed, matching how
// Drive/Dropbox count it), so restore is instant with no re-reservation
// race. A cron job (see lib/cleanup.ts) permanently deletes anything still
// in trash after 30 days.
export async function deleteFile(fileId: string) {
  const identity = await requireIdentity();

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || !ownsFile(file, identity)) throw new Error("Not found.");

  // updateMany (not update) so the status: "COMMITTED" precondition is
  // part of the atomic operation itself, not a separate check-then-act
  // step — closes the same resurrect-a-purged-file window as bulkDeleteFiles.
  const { count } = await prisma.file.updateMany({
    where: { id: fileId, status: "COMMITTED" },
    data: { status: "DELETED", deletedAt: new Date() },
  });
  if (count === 0) throw new Error("This file isn't in a state that can be deleted.");

  revalidatePath(file.folderId ? `/folder/${file.folderId}` : "/dashboard");
  revalidatePath("/upload");
  revalidatePath("/trash");
}

export async function restoreFile(fileId: string) {
  const identity = await requireIdentity();

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || !ownsFile(file, identity)) throw new Error("Not found.");

  // status: "DELETED" guard, atomic with the update — without this, restoring
  // an already-PURGED file resurrects it to COMMITTED without re-adding its
  // bytes to usedBytes (they were already released on purge), silently
  // granting the user free, uncounted storage.
  const { count } = await prisma.file.updateMany({
    where: { id: fileId, status: "DELETED" },
    data: { status: "COMMITTED", deletedAt: null },
  });
  if (count === 0) throw new Error("This file isn't in trash.");

  revalidatePath("/trash");
  revalidatePath(file.folderId ? `/folder/${file.folderId}` : "/dashboard");
}

// "Delete forever" from the user's own perspective only — the disk blob and
// DB row are retained (status flips to PURGED, never actually removed) so a
// superuser can still recover it from /backstage. Quota is released like a
// real delete; the file itself is not.
export async function permanentlyDeleteFile(fileId: string) {
  const identity = await requireIdentity();

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || !ownsFile(file, identity)) throw new Error("Not found.");

  await prisma.$transaction(async (tx) => {
    // status: "DELETED" guard as part of the same atomic update that does
    // the purge — without it, a double-invocation (double-click, retry, or
    // a race with the cleanup cron) decrements usedBytes a second time for
    // a file whose bytes were already released, silently granting free quota.
    const { count } = await tx.file.updateMany({
      where: { id: fileId, status: "DELETED" },
      data: { status: "PURGED" },
    });
    if (count === 0) throw new Error("This file isn't in trash.");

    await adjustOwnerUsedBytes(tx, identity, -file.size);
  });

  revalidatePath("/trash");
}

export async function bulkRestoreFiles(fileIds: string[]) {
  const identity = await requireIdentity();
  if (fileIds.length === 0) return;

  const where = ownerWhere(identity);

  // status: "DELETED" guard — see restoreFile() for why this matters.
  await prisma.file.updateMany({
    where: { id: { in: fileIds }, ...where, status: "DELETED" },
    data: { status: "COMMITTED", deletedAt: null },
  });

  revalidatePath("/trash");
  revalidatePath("/dashboard");
}

// Same "hidden from the user, retained for a superuser" treatment as
// permanentlyDeleteFile() above, applied to a whole selection at once.
export async function bulkPermanentlyDeleteFiles(fileIds: string[]) {
  const identity = await requireIdentity();
  if (fileIds.length === 0) return;

  const where = ownerWhere(identity);
  // status: "DELETED" guard — see permanentlyDeleteFile() for why this matters.
  const files = await prisma.file.findMany({ where: { id: { in: fileIds }, ...where, status: "DELETED" } });
  if (files.length === 0) return;

  // Per-file conditional update+decrement (not one batch updateMany) so
  // "which files did this transaction actually purge" is never ambiguous —
  // a file raced to PURGED by a concurrent request simply fails its own
  // status: "DELETED" precondition and is skipped, with no risk of
  // double-counting bytes someone else's request already decremented.
  await prisma.$transaction(async (tx) => {
    for (const file of files) {
      const { count } = await tx.file.updateMany({
        where: { id: file.id, status: "DELETED" },
        data: { status: "PURGED" },
      });
      if (count === 0) continue;

      await adjustOwnerUsedBytes(tx, identity, -file.size);
    }
  });

  revalidatePath("/trash");
}
