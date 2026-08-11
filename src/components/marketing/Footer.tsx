import Link from "next/link";
import { Cloud } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-ink-faint sm:flex-row">
        <div className="flex items-center gap-2 text-ink-muted">
          <Cloud className="size-4" aria-hidden />
          <span>bongshai.cloud</span>
        </div>
        <p>Free tier: 25GB registered · 2GB without an account.</p>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <p>&copy; {new Date().getFullYear()} Bongshai Cloud</p>
        </div>
      </div>
    </footer>
  );
}
