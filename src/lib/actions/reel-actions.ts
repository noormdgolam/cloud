"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordFileView } from "@/lib/file-views";

async function getRequestIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

// Called from the feed client as each reel becomes the active/playing one —
// counts toward the same File.viewCount the share-link pages use, so
// earnings math never has to reconcile two separate view sources.
export async function recordReelView(fileId: string) {
  await recordFileView(fileId, await getRequestIp());
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in.");
  return session.user.id;
}

export async function publishReel(fileId: string, formData: FormData) {
  const userId = await requireUserId();

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { creatorProgramEnabled: true } });
  if (!user.creatorProgramEnabled) {
    throw new Error("Join the earn-money program first.");
  }

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.userId !== userId || file.status !== "COMMITTED") throw new Error("File not found.");
  if (!file.mimeType.startsWith("video/")) throw new Error("Only video files can be published as reels.");

  const caption = String(formData.get("caption") ?? "").trim().slice(0, 500) || null;

  await prisma.reel.upsert({
    where: { fileId },
    create: { fileId, userId, caption, published: true },
    update: { published: true, caption },
  });

  revalidatePath("/earn");
  revalidatePath("/reels");
}

export async function unpublishReel(reelId: string) {
  const userId = await requireUserId();
  const reel = await prisma.reel.findUnique({ where: { id: reelId } });
  if (!reel || reel.userId !== userId) throw new Error("Not found.");

  await prisma.reel.update({ where: { id: reelId }, data: { published: false } });

  revalidatePath("/earn");
  revalidatePath("/reels");
}
