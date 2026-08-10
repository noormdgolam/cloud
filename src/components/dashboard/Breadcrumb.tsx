import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { BreadcrumbEntry } from "@/lib/data/browser";

export function Breadcrumb({ entries }: { entries: BreadcrumbEntry[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-ink-muted">
      <Link href="/dashboard" className="transition-colors hover:text-ink">
        My files
      </Link>
      {entries.map((entry) => (
        <span key={entry.id} className="flex items-center gap-1.5">
          <ChevronRight className="size-3.5 text-ink-faint" aria-hidden />
          <Link href={`/folder/${entry.id}`} className="transition-colors hover:text-ink">
            {entry.name}
          </Link>
        </span>
      ))}
    </nav>
  );
}
