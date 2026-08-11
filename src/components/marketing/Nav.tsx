import Link from "next/link";
import { Cloud } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6">
      <div className="glass mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-2.5 sm:px-5">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <Cloud className="size-5 text-accent" strokeWidth={2.25} aria-hidden />
          <span className="text-[0.95rem] font-semibold tracking-tight">
            bongshai<span className="text-ink-muted">.cloud</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-ink-muted sm:flex">
          <a href="#tiers" className="transition-colors hover:text-ink">
            Storage
          </a>
          <a href="#features" className="transition-colors hover:text-ink">
            Features
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LinkButton href="/login" variant="ghost" className="hidden px-4 py-2 text-sm sm:inline-flex">
            Sign in
          </LinkButton>
          <LinkButton href="/register" variant="accent" className="px-4 py-2 text-sm">
            Get started
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
