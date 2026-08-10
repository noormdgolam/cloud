"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/anon-session";

export type ClaimResult = { error?: string; claimedCount?: number };

export async function claimAnonymousFiles(): Promise<ClaimResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Not authenticated." };

  const anonId = await getAnonId();
  if (!anonId) return { error: "No anonymous session found." };

  return prisma.$transaction(async (tx) => {
    const anonSession = await tx.anonymousSession.findUnique({ where: { id: anonId } });
    if (!anonSession || anonSession.claimedByUserId) {
      return { error: "Nothing to claim." };
    }

    const [user] = await tx.$queryRaw<{ usedBytes: bigint; quotaBytes: bigint | null }[]>`
      SELECT usedBytes, quotaBytes FROM User WHERE id = ${userId} FOR UPDATE
    `;
    if (!user) return { error: "User not found." };

    const wouldExceed =
      user.quotaBytes !== null && user.usedBytes + anonSession.usedBytes > user.quotaBytes;

    if (wouldExceed) {
      return {
        error:
          "Claiming these files would put you over your 25GB limit. Delete a few anonymous files first, or free up space in your account.",
      };
    }

    const { count } = await tx.file.updateMany({
      where: { anonymousSessionId: anonId },
      data: { userId, anonymousSessionId: null },
    });

    await tx.folder.updateMany({
      where: { anonymousSessionId: anonId },
      data: { userId, anonymousSessionId: null },
    });

    await tx.user.update({
      where: { id: userId },
      data: { usedBytes: { increment: anonSession.usedBytes } },
    });

    await tx.anonymousSession.update({
      where: { id: anonId },
      data: { usedBytes: BigInt(0), claimedByUserId: userId },
    });

    return { claimedCount: count };
  }, { maxWait: 10_000, timeout: 15_000 }).then((result) => {
    if (result.claimedCount) {
      revalidatePath("/dashboard");
    }
    return result;
  });
}

export async function hasClaimableFiles(): Promise<{ count: number; totalBytes: bigint } | null> {
  const anonId = await getAnonId();
  if (!anonId) return null;

  const session = await prisma.anonymousSession.findUnique({ where: { id: anonId } });
  if (!session || session.claimedByUserId || session.usedBytes === BigInt(0)) return null;

  const count = await prisma.file.count({ where: { anonymousSessionId: anonId } });
  if (count === 0) return null;

  return { count, totalBytes: session.usedBytes };
}
