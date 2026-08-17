import Link from "next/link";
import { Cloud, ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 text-sm text-ink-faint">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-ink-muted">
            <Cloud className="size-4 text-accent" aria-hidden />
            <span className="font-semibold text-ink">bongshai.cloud</span>
            <span className="text-ink-faint">·</span>
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-muted">
              <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
              Systems Operational
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <Link href="/terms" className="transition-colors hover:text-ink">
              Terms of Service
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-ink">
              Privacy Policy
            </Link>
            <Link href="/earn" className="transition-colors hover:text-ink">
              Creator Program
            </Link>
            <Link href="/upload" className="transition-colors hover:text-ink">
              Anonymous Upload
            </Link>
            <Link href="/llms.txt" className="font-mono text-ink-faint hover:text-accent">
              llms.txt
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-border/50 pt-4 text-xs text-ink-faint sm:flex-row">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-accent" />
            Engineered &amp; Maintained by Bongshai Systems &amp; Infrastructure Team
          </p>
          <p>
            Last Updated: August 15, 2026 · &copy; {new Date().getFullYear()} Bongshai Cloud
          </p>
        </div>
      </div>
    </footer>
  );
}
