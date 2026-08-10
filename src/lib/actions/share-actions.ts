"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/anon-session";

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

export async function getActiveShareLink(fileId: string) {
  const identity = await requireIdentity();
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || !ownsFile(file, identity)) return null;

  return prisma.shareLink.findFirst({
    where: { fileId, revoked: false },
    orderBy: { createdAt: "desc" },
  });
}

export async function createShareLink(
  fileId: string,
  options: { expiresInDays: number | null; maxDownloads: number | null }
) {
  const identity = await requireIdentity();
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || !ownsFile(file, identity)) throw new Error("Not found.");

  const token = randomBytes(18).toString("base64url");
  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const link = await prisma.shareLink.create({
    data: {
      token,
      fileId,
      expiresAt,
      maxDownloads: options.maxDownloads,
      ...("userId" in identity
        ? { createdByUserId: identity.userId }
        : { createdByAnonId: identity.anonymousSessionId }),
    },
  });

  revalidatePath(file.folderId ? `/folder/${file.folderId}` : "/dashboard");
  revalidatePath("/upload");
  return link;
}

export async function revokeShareLink(shareLinkId: string) {
  const identity = await requireIdentity();
  const link = await prisma.shareLink.findUnique({
    where: { id: shareLinkId },
    include: { file: true },
  });
  if (!link || !ownsFile(link.file, identity)) throw new Error("Not found.");

  await prisma.shareLink.update({ where: { id: shareLinkId }, data: { revoked: true } });

  revalidatePath(link.file.folderId ? `/folder/${link.file.folderId}` : "/dashboard");
  revalidatePath("/upload");
}
