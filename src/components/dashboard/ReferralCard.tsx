"use client";

import { useState } from "react";
import { Check, Copy, Gift } from "lucide-react";
import { formatBytes } from "@/lib/format";

export function ReferralCard({
  code,
  referralCount,
  bonusBytes,
  origin,
}: {
  code: string;
  referralCount: number;
  bonusBytes: bigint;
  origin: string;
}) {
  const [copied, setCopied] = useState(false);
  const referralUrl = `${origin}/register?ref=${code}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-2 px-3.5 py-2.5">
        <Gift className="size-4 shrink-0 text-ink-faint" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-muted">{referralUrl}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(referralUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-lg p-1 text-ink-faint transition-colors hover:bg-[var(--glass-surface-hover)] hover:text-ink"
        >
          {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        </button>
      </div>
      <div className="flex items-center gap-4 text-xs text-ink-faint">
        <span>
          <span className="font-mono text-sm text-ink">{referralCount}</span> friend{referralCount === 1 ? "" : "s"} joined
        </span>
        <span>
          <span className="font-mono text-sm text-ink">{formatBytes(bonusBytes)}</span> bonus storage earned
        </span>
      </div>
    </div>
  );
}
