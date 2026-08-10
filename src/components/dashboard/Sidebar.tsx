import Link from "next/link";
import { Cloud, FolderOpen, LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth-actions";
import { StorageMeter } from "./StorageMeter";

export function Sidebar({
  userName,
  userEmail,
  usedBytes,
  quotaBytes,
}: {
  userName: string | null;
  userEmail: string;
  usedBytes: bigint;
  quotaBytes: bigint | null;
}) {
  const initial = (userName ?? userEmail).charAt(0).toUpperCase();

  return (
    <aside className="glass sticky top-4 flex h-[calc(100vh-2rem)] w-64 shrink-0 flex-col rounded-2xl p-4">
      <Link href="/" className="flex items-center gap-2 px-2 py-2 text-ink">
        <Cloud className="size-5 text-accent" strokeWidth={2.25} aria-hidden />
        <span className="text-[0.95rem] font-semibold tracking-tight">
          bongshai<span className="text-ink-muted">.cloud</span>
        </span>
      </Link>

      <nav className="mt-6 flex flex-1 flex-col gap-1">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-xl bg-[var(--glass-surface)] px-3 py-2.5 text-sm font-medium text-ink"
        >
          <FolderOpen className="size-4 text-accent" strokeWidth={1.75} aria-hidden />
          My files
        </Link>
      </nav>

      <div className="mb-3 rounded-xl border border-border bg-bg-2 p-3">
        <StorageMeter usedBytes={usedBytes} quotaBytes={quotaBytes} />
      </div>

      <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/20 font-mono text-xs font-semibold text-accent-2">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-ink">{userName ?? userEmail}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            title="Sign out"
            className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-[var(--glass-surface-hover)] hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden />
            <span className="sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
