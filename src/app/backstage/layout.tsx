import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const metadata = { title: "Backstage", robots: { index: false, follow: false } };

export default async function BackstageLayout({ children }: LayoutProps<"/backstage">) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-bg-1">
      <header className="sticky top-0 z-40 border-b border-border bg-bg-1/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/backstage" className="flex items-center gap-2 text-ink">
              <ShieldAlert className="size-4 text-danger" strokeWidth={2} aria-hidden />
              <span className="font-mono text-sm font-semibold tracking-tight">backstage</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4 text-xs font-medium text-ink-muted">
              <Link href="/backstage" className="hover:text-ink transition-colors">
                Users
              </Link>
              <Link href="/backstage/vault" className="hover:text-ink transition-colors text-accent-2 font-semibold">
                Special Vault
              </Link>
              <Link href="/backstage/moderation" className="hover:text-ink transition-colors text-danger">
                NSFW Moderation
              </Link>
              <Link href="/backstage/anonymous" className="hover:text-ink transition-colors">
                Anonymous
              </Link>
              <Link href="/backstage/revenue" className="hover:text-ink transition-colors">
                Revenue
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-faint">
            <span>{admin.name ?? admin.email}</span>
            <ThemeToggle />
            <Link href="/dashboard" className="hover:text-ink">
              Exit
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
