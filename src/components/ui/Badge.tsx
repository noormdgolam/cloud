import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border-strong",
        "bg-[var(--glass-surface)] px-3 py-1 font-mono text-[0.7rem] uppercase",
        "tracking-[0.14em] text-ink-muted",
        className
      )}
      {...props}
    />
  );
}
