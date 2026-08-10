const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(value: bigint | number): string {
  let bytes = typeof value === "bigint" ? Number(value) : value;
  let unitIndex = 0;

  while (bytes >= 1024 && unitIndex < UNITS.length - 1) {
    bytes /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : bytes < 10 ? 2 : bytes < 100 ? 1 : 0;
  return `${bytes.toFixed(precision)} ${UNITS[unitIndex]}`;
}

export function formatRelativeDate(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
