"use client";

import { useRouter } from "next/navigation";
import type { SortOption } from "@/lib/data/browser";

export function SortSelect({ basePath, sort }: { basePath: string; sort: SortOption }) {
  const router = useRouter();

  return (
    <select
      value={sort}
      onChange={(e) => router.push(`${basePath}?sort=${e.target.value}`)}
      aria-label="Sort files"
      className="rounded-xl border border-border bg-bg-2 px-3 py-2 text-sm text-ink focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent/40"
    >
      <option value="date">Newest first</option>
      <option value="name">Name (A–Z)</option>
      <option value="size">Largest first</option>
    </select>
  );
}
