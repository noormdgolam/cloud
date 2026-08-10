import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  hover?: boolean;
};

export function GlassCard({ className, hover = false, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass rounded-2xl",
        hover &&
          "transition-colors duration-200 hover:border-border-strong hover:bg-[var(--glass-surface-hover)]",
        className
      )}
      {...props}
    />
  );
}
