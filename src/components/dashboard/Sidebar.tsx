"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cloud, FolderOpen, LogOut, Menu, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/lib/actions/auth-actions";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { StorageMeter } from "./StorageMeter";

type SidebarProps = {
  userName: string | null;
  userEmail: string;
  usedBytes: bigint;
  quotaBytes: bigint | null;
};

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 px-2 py-2 text-ink">
      <Cloud className="size-5 text-accent" strokeWidth={2.25} aria-hidden />
      <span className="text-[0.95rem] font-semibold tracking-tight">
        bongshai<span className="text-ink-muted">.cloud</span>
      </span>
    </Link>
  );
}

function SidebarBody({
  userName,
  userEmail,
  usedBytes,
  quotaBytes,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const initial = (userName ?? userEmail).charAt(0).toUpperCase();
  const pathname = usePathname();
  const onSettings = pathname === "/settings";

  return (
    <>
      <nav className="mt-6 flex flex-1 flex-col gap-1">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink",
            !onSettings && "bg-[var(--glass-surface)]"
          )}
        >
          <FolderOpen className="size-4 text-accent" strokeWidth={1.75} aria-hidden />
          My files
        </Link>
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink",
            onSettings && "bg-[var(--glass-surface)]"
          )}
        >
          <Settings className="size-4 text-ink-muted" strokeWidth={1.75} aria-hidden />
          Settings
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
        <ThemeToggle />
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
    </>
  );
}

// Persistent rail on md+ screens.
export function Sidebar(props: SidebarProps) {
  return (
    <aside className="glass sticky top-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col rounded-2xl p-4 md:flex">
      <Logo />
      <SidebarBody {...props} />
    </aside>
  );
}

// Compact top bar + slide-in-place menu below md, where a 256px fixed rail
// would leave the file browser with no usable width.
export function MobileNav(props: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass sticky top-4 z-40 flex items-center justify-between rounded-2xl p-2.5 md:hidden">
      <Logo />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="Open menu"
            className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-[var(--glass-surface-hover)] hover:text-ink"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </DialogTrigger>
        <DialogContent title="Menu" className="flex max-h-[80vh] flex-col p-4">
          <SidebarBody {...props} onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
