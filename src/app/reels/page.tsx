import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getReelsFeed } from "@/lib/data/reels";
import { ReelsFeedClient } from "@/components/reels/ReelsFeedClient";
import { AdSlot } from "@/components/ads/AdSlot";

export const metadata: Metadata = { title: "Reels" };
// Without this, Next has no dynamic API (cookies/headers) to key off and
// will happily prerender this page once at build time — freezing the feed
// on whatever was published at that moment instead of querying fresh.
export const dynamic = "force-dynamic";

export default async function ReelsPage() {
  const { items, nextCursor } = await getReelsFeed();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <AdSlot />
      <Link
        href="/"
        className="absolute left-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-black/50 text-white"
        aria-label="Back to Bongshai Cloud"
      >
        <ArrowLeft className="size-4" aria-hidden />
      </Link>
      <ReelsFeedClient
        initialItems={items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() }))}
        initialCursor={nextCursor}
      />
    </div>
  );
}
