"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

export function ThemeToggle({ className }: { className?: string }) {
  // Server always renders the light-mode icon (the light default); if the
  // inline anti-flash script already set data-theme="dark" pre-hydration,
  // this corrects itself in the effect below — matching server output on
  // first render is what avoids a real hydration mismatch.
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Reading the DOM (set synchronously by the pre-hydration inline script
    // in the root layout) to sync React state with it on mount — the
    // documented-as-fine case for this rule, not the pattern it's meant to
    // catch. There's no server-known value to use as a lazy initial state
    // instead: doing so would read the real DOM during hydration and could
    // disagree with the server-rendered light-mode default, which is the
    // actual mismatch this two-step approach avoids.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-[var(--glass-surface-hover)] hover:text-ink",
        className
      )}
    >
      {dark ? <Sun className="size-4" strokeWidth={1.75} aria-hidden /> : <Moon className="size-4" strokeWidth={1.75} aria-hidden />}
    </button>
  );
}
