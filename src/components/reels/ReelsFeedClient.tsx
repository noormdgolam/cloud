"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { recordReelView } from "@/lib/actions/reel-actions";
import type { ReelFeedItem } from "@/lib/data/reels";

type FeedItem = Omit<ReelFeedItem, "createdAt"> & { createdAt: string };

function ReelCard({ item, active, muted, onToggleMute }: { item: FeedItem; active: boolean; muted: boolean; onToggleMute: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.play().catch(() => {});
      if (!viewedRef.current) {
        viewedRef.current = true;
        void recordReelView(item.fileId);
      }
    } else {
      video.pause();
    }
  }, [active, item.fileId]);

  return (
    <div className="relative flex h-full w-full shrink-0 snap-start items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={`/api/reels/${item.id}/video`}
        loop
        muted={muted}
        playsInline
        className="h-full w-full object-contain"
        onClick={onToggleMute}
      />
      <button
        type="button"
        onClick={onToggleMute}
        className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-black/50 text-white"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
      </button>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pb-8 text-white">
        {item.creatorName && <p className="text-sm font-medium">@{item.creatorName}</p>}
        {item.caption && <p className="mt-1 text-sm text-white/90">{item.caption}</p>}
      </div>
    </div>
  );
}

export function ReelsFeedClient({ initialItems, initialCursor }: { initialItems: FeedItem[]; initialCursor: string | null }) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || cursor === null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reels/feed?cursor=${encodeURIComponent(cursor)}`);
      const data = await res.json();
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const index = Math.round(el.scrollTop / el.clientHeight);
    if (index !== activeIndex) setActiveIndex(index);
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - el.clientHeight * 2) {
      loadMore();
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-center text-sm text-white/70">
        No reels yet. Be the first to publish one.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-full w-full snap-y snap-mandatory overflow-y-auto"
    >
      {items.map((item, i) => (
        <ReelCard key={item.id} item={item} active={i === activeIndex} muted={muted} onToggleMute={() => setMuted((m) => !m)} />
      ))}
    </div>
  );
}
