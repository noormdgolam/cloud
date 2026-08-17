import { prisma } from "@/lib/prisma";

export type ReelFeedItem = {
  id: string;
  caption: string | null;
  createdAt: Date;
  fileId: string;
  mimeType: string;
  creatorName: string | null;
};

const FEED_PAGE_SIZE = 10;

export async function getReelsFeed(cursor?: string): Promise<{ items: ReelFeedItem[]; nextCursor: string | null }> {
  const reels = await prisma.reel.findMany({
    where: { published: true, file: { status: "COMMITTED" } },
    orderBy: { createdAt: "desc" },
    take: FEED_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { file: { select: { mimeType: true } }, user: { select: { name: true } } },
  });

  const hasMore = reels.length > FEED_PAGE_SIZE;
  const page = hasMore ? reels.slice(0, FEED_PAGE_SIZE) : reels;

  return {
    items: page.map((r) => ({
      id: r.id,
      caption: r.caption,
      createdAt: r.createdAt,
      fileId: r.fileId,
      mimeType: r.file.mimeType,
      creatorName: r.user.name,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export type UserReel = {
  id: string;
  fileId: string;
  fileName: string;
  caption: string | null;
  published: boolean;
  viewCount: bigint;
  createdAt: Date;
};

export async function getUserReels(userId: string): Promise<UserReel[]> {
  const reels = await prisma.reel.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { file: { select: { originalName: true, viewCount: true } } },
  });

  return reels.map((r) => ({
    id: r.id,
    fileId: r.fileId,
    fileName: r.file.originalName,
    caption: r.caption,
    published: r.published,
    viewCount: r.file.viewCount,
    createdAt: r.createdAt,
  }));
}
