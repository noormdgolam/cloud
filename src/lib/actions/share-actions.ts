"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/anon-session";
import { shareCookieMaxAgeSeconds, shareCookieName, signShareAccess } from "@/lib/share-auth";
import { checkRateLimit, RateLimitExceededError } from "@/lib/rate-limit";

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

  const link = await prisma.shareLink.findFirst({
    where: { fileId, revoked: false },
    orderBy: { createdAt: "desc" },
  });
  if (!link) return null;

  // Never send the hash itself to the client — only whether one exists.
  const { passwordHash, ...rest } = link;
  return { ...rest, hasPassword: passwordHash !== null };
}

export async function createShareLink(
  fileId: string,
  options: { expiresInDays: number | null; maxDownloads: number | null; password: string | null }
) {
  const identity = await requireIdentity();
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || !ownsFile(file, identity)) throw new Error("Not found.");

  const token = randomBytes(18).toString("base64url");
  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  const passwordHash = options.password ? await bcrypt.hash(options.password, 12) : null;

  const link = await prisma.shareLink.create({
    data: {
      token,
      fileId,
      expiresAt,
      maxDownloads: options.maxDownloads,
      passwordHash,
      ...("userId" in identity
        ? { createdByUserId: identity.userId }
        : { createdByAnonId: identity.anonymousSessionId }),
    },
  });

  revalidatePath(file.folderId ? `/folder/${file.folderId}` : "/dashboard");
  revalidatePath("/upload");
  const { passwordHash: createdHash, ...rest } = link;
  return { ...rest, hasPassword: createdHash !== null };
}

export async function unlockShareLink(token: string, password: string) {
  // Keyed per-token (not per-IP) — the threat here is someone who already
  // has the (unguessable) token brute-forcing a weak password, which IP
  // rotation wouldn't help them evade if the limit is per-token.
  try {
    await checkRateLimit(`${token}:unlock-share`, { limit: 10, windowMs: 15 * 60 * 1000 });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      throw new Error("Too many attempts. Try again in a few minutes.");
    }
    throw error;
  }

  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link || link.revoked || !link.passwordHash) throw new Error("Invalid link.");
  if (link.expiresAt && link.expiresAt < new Date()) throw new Error("This link has expired.");

  const valid = await bcrypt.compare(password, link.passwordHash);
  if (!valid) throw new Error("Incorrect password.");

  const jar = await cookies();
  jar.set(shareCookieName(token), signShareAccess(token), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: shareCookieMaxAgeSeconds(),
  });
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
