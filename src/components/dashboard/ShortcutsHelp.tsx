"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";

const SHORTCUTS = [
  { keys: ["⌘", "K"], description: "Open command palette" },
  { keys: ["Esc"], description: "Exit selection mode" },
  { keys: ["Delete"], description: "Move selected files to trash" },
  { keys: ["?"], description: "Show this list" },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Keyboard shortcuts">
        <div className="flex flex-col gap-1">
          {SHORTCUTS.map((s) => (
            <div key={s.description} className="flex items-center justify-between gap-4 rounded-lg px-2 py-2">
              <span className="text-sm text-ink-muted">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded border border-border-strong bg-bg-2 px-1.5 py-0.5 font-mono text-xs text-ink"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
