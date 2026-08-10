import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium " +
  "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-1 " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants = {
  primary:
    "bg-ink text-bg-0 hover:bg-white px-5 py-2.5 shadow-[0_1px_0_0_rgba(255,255,255,0.4)_inset]",
  accent:
    "bg-accent text-white hover:brightness-110 px-5 py-2.5 shadow-[0_0_0_1px_rgba(124,92,255,0.4),0_8px_24px_-8px_rgba(124,92,255,0.6)]",
  ghost:
    "border border-border text-ink hover:border-border-strong hover:bg-[var(--glass-surface)] px-5 py-2.5",
  link: "text-ink-muted hover:text-ink px-0 py-0",
} as const;

type Variant = keyof typeof variants;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return <button className={cn(base, variants[variant], className)} {...props} />;
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
};

export function LinkButton({ className, variant = "primary", ...props }: LinkButtonProps) {
  return <a className={cn(base, variants[variant], className)} {...props} />;
}
