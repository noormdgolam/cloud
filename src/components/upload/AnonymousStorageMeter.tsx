import { formatBytes } from "@/lib/format";

export function AnonymousStorageMeter({
  usedBytes,
  quotaBytes,
}: {
  usedBytes: bigint;
  quotaBytes: bigint;
}) {
  const used = Number(usedBytes);
  const quota = Number(quotaBytes) || 1;
  const percent = Math.min(100, (used / quota) * 100);
  const nearLimit = percent >= 90;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs text-ink-muted">Storage used this session</span>
        <span className="font-mono text-xs text-ink-muted">
          {formatBytes(usedBytes)} of {formatBytes(quotaBytes)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg-2">
        <div
          className={
            nearLimit
              ? "h-full rounded-full bg-danger"
              : "h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
          }
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>
    </div>
  );
}
