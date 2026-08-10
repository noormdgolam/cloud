import { FileText, FolderClosed, Image as ImageIcon, Video } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

const files = [
  { name: "design-system.fig", size: "84 MB", icon: ImageIcon },
  { name: "keynote-master.mp4", size: "1.2 GB", icon: Video },
  { name: "quarterly-report.pdf", size: "6 MB", icon: FileText },
  { name: "client-assets", size: "128 items", icon: FolderClosed },
];

export function HeroPreviewPanel() {
  return (
    <GlassCard className="w-full max-w-md p-4 sm:p-5" aria-hidden>
      <div className="flex items-center justify-between px-1 pb-3">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-faint">
          My files
        </span>
        <span className="font-mono text-[0.7rem] text-ink-faint">4 items</span>
      </div>

      <ul className="flex flex-col gap-1">
        {files.map((file) => (
          <li
            key={file.name}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--glass-surface-hover)]"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-2">
              <file.icon className="size-4 text-ink-muted" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{file.name}</span>
            <span className="font-mono text-xs text-ink-faint">{file.size}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-border pt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs text-ink-muted">Storage used</span>
          <span className="font-mono text-xs text-ink-muted">6.4 GB of 25 GB</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-bg-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
            style={{ width: "26%" }}
          />
        </div>
      </div>
    </GlassCard>
  );
}
