"use client";

import { useState, useTransition } from "react";
import { Sparkles, X } from "lucide-react";
import { claimAnonymousFiles } from "@/lib/actions/claim-actions";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/Button";

export function ClaimBanner({ count, totalBytes }: { count: number; totalBytes: bigint }) {
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (dismissed) return null;

  return (
    <div className="glass mb-6 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
      <Sparkles className="size-5 shrink-0 text-accent-2" aria-hidden />
      <p className="flex-1 text-sm text-ink-muted">
        You have <span className="text-ink">{count} file{count === 1 ? "" : "s"}</span> (
        {formatBytes(totalBytes)}) from before you signed up. Claim them to keep them here.
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="accent"
          className="px-3 py-1.5 text-xs"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await claimAnonymousFiles();
              if (result.error) {
                setError(result.error);
              } else {
                setDismissed(true);
              }
            })
          }
        >
          {pending ? "Claiming…" : "Claim files"}
        </Button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-[var(--glass-surface-hover)] hover:text-ink"
          aria-label="Dismiss"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
