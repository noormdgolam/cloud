import type { InputHTMLAttributes, LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-border bg-bg-2 px-3.5 py-2.5 text-sm text-ink",
        "placeholder:text-ink-faint",
        "transition-colors focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent/40",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-ink-muted", className)}
      {...props}
    />
  );
}
