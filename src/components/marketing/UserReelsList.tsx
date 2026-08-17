"use client";

import { useState } from "react";
import Link from "next/link";
import { EyeOff, Film } from "lucide-react";
import { unpublishReel } from "@/lib/actions/reel-actions";
import type { UserReel } from "@/lib/data/reels";

export function UserReelsList({ reels }: { reels: UserReel[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = reels.filter((r) => r.published && !hidden.has(r.id));
  if (visible.length === 0) return null;

  return (
    <div className="sm:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Your reels</h2>
        <Link href="/reels" className="flex items-center gap-1 text-xs text-accent hover:underline">
          <Film className="size-3.5" aria-hidden />
          Watch the feed
        </Link>
      </div>
      <div className="glass flex flex-col gap-0.5 rounded-2xl p-2">
        {visible.map((reel) => (
          <div key={reel.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ink">{reel.caption || reel.fileName}</span>
              <span className="block text-xs text-ink-faint">{reel.viewCount.toLocaleString()} views</span>
            </span>
            <button
              type="button"
              disabled={busyId === reel.id}
              onClick={async () => {
                setBusyId(reel.id);
                await unpublishReel(reel.id);
                setHidden((prev) => new Set(prev).add(reel.id));
                setBusyId(null);
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-ink-faint hover:bg-[var(--glass-surface-hover)] hover:text-ink disabled:opacity-40"
            >
              <EyeOff className="size-3.5" aria-hidden />
              Unpublish
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
