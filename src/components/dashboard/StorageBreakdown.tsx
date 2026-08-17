import { formatBytes } from "@/lib/format";
import type { StorageCategory } from "@/lib/data/storage-breakdown";

// Fixed category -> hue-slot assignment, validated against this app's own
// light (#eceef3) and dark (#10131b) surfaces via the dataviz skill's
// validator — never cycled, never re-derived from data. Light mode clears
// every check except contrast (expected for 4 of 6 slots per the skill's
// own palette docs), which is why every row also carries a direct text
// label rather than relying on the swatch color alone.
const CATEGORY_META: Record<StorageCategory, { label: string; var: string }> = {
  images: { label: "Images", var: "--viz-1" },
  videos: { label: "Videos", var: "--viz-2" },
  audio: { label: "Audio", var: "--viz-3" },
  documents: { label: "Documents", var: "--viz-4" },
  archives: { label: "Archives", var: "--viz-5" },
  other: { label: "Other", var: "--viz-6" },
};

export function StorageBreakdown({ rows }: { rows: { category: StorageCategory; bytes: bigint }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">Upload a few files to see a breakdown here.</p>;
  }

  const sorted = [...rows].sort((a, b) => (b.bytes > a.bytes ? 1 : -1));
  const max = sorted[0].bytes;

  return (
    <div className="viz-root flex flex-col gap-3">
      <style>{`
        .viz-root {
          --viz-1: #2a78d6; --viz-2: #eb6834; --viz-3: #1baf7a;
          --viz-4: #eda100; --viz-5: #e87ba4; --viz-6: #008300;
        }
        :root[data-theme="dark"] .viz-root {
          --viz-1: #3987e5; --viz-2: #d95926; --viz-3: #199e70;
          --viz-4: #c98500; --viz-5: #d55181; --viz-6: #008300;
        }
      `}</style>
      {sorted.map(({ category, bytes }) => {
        const meta = CATEGORY_META[category];
        const percent = max > BigInt(0) ? Number((bytes * BigInt(1000)) / max) / 10 : 0;
        return (
          <div key={category} className="flex flex-col gap-1" title={`${meta.label}: ${formatBytes(bytes)}`}>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-ink-muted">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: `var(${meta.var})` }}
                  aria-hidden
                />
                {meta.label}
              </span>
              <span className="font-mono text-ink-faint">{formatBytes(bytes)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-sm bg-bg-2">
              {/* Square at the baseline (left), 4px rounded only at the data-end (right) — per mark spec */}
              <div
                className="h-full rounded-r-[4px]"
                style={{ width: `${Math.max(percent, 2)}%`, backgroundColor: `var(${meta.var})` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
