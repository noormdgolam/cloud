import Link from "next/link";
import { Cloud } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg-1 px-4 py-12">
      <div className="grid-fade glow-accent pointer-events-none absolute inset-0" aria-hidden />
      <Link
        href="/"
        className="relative mb-8 flex items-center gap-2 text-ink"
      >
        <Cloud className="size-5 text-accent" strokeWidth={2.25} aria-hidden />
        <span className="text-[0.95rem] font-semibold tracking-tight">
          bongshai<span className="text-ink-muted">.cloud</span>
        </span>
      </Link>

      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}
