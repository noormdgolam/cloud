import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata = { title: "Backstage", robots: { index: false, follow: false } };

export default async function BackstageLayout({ children }: LayoutProps<"/backstage">) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-bg-1">
      <header className="sticky top-0 z-40 border-b border-border bg-bg-1/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/backstage" className="flex items-center gap-2 text-ink">
            <ShieldAlert className="size-4 text-danger" strokeWidth={2} aria-hidden />
            <span className="font-mono text-sm font-semibold tracking-tight">backstage</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-ink-faint">
            <span>{admin.name ?? admin.email}</span>
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
