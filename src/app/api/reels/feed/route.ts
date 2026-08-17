import { NextResponse, type NextRequest } from "next/server";
import { getReelsFeed } from "@/lib/data/reels";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const { items, nextCursor } = await getReelsFeed(cursor);
  return NextResponse.json({
    items: items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })),
    nextCursor,
  });
}
