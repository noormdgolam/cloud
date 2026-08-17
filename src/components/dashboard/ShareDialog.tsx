"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Lock } from "lucide-react";
import { createShareLink, getActiveShareLink, revokeShareLink } from "@/lib/actions/share-actions";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type Link = { id: string; token: string; expiresAt: Date | null; hasPassword: boolean };

export function ShareDialog({
  fileId,
  fileName,
  open,
  onOpenChange,
}: {
  fileId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // undefined = not fetched yet, null = fetched and no active link exists.
  const [link, setLink] = useState<Link | null | undefined>(undefined);
  const [expiresInDays, setExpiresInDays] = useState<string>("7");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const loading = open && link === undefined;

  useEffect(() => {
    if (!open || link !== undefined) return;
    let cancelled = false;
    getActiveShareLink(fileId).then((result) => {
      if (!cancelled) setLink(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open, fileId, link]);

  const shareUrl = link ? `${window.location.origin}/s/${link.token}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Share "${fileName}"`}>
        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : link ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-2 px-3 py-2.5">
              <Link2 className="size-4 shrink-0 text-ink-faint" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-muted">
                {shareUrl}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="shrink-0 rounded-lg p-1 text-ink-faint transition-colors hover:bg-[var(--glass-surface-hover)] hover:text-ink"
              >
                {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              </button>
            </div>
            {(link.expiresAt || link.hasPassword) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                {link.expiresAt && (
                  <span>
                    Expires {link.expiresAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
                {link.hasPassword && (
                  <span className="flex items-center gap-1">
                    <Lock className="size-3" aria-hidden />
                    Password protected
                  </span>
                )}
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              className="w-full border-danger/40 text-danger hover:border-danger"
              onClick={async () => {
                await revokeShareLink(link.id);
                setLink(null);
              }}
            >
              Revoke link
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-muted">Expires</label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg-2 px-3.5 py-2.5 text-sm text-ink focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="0">Never</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-muted">
                Password <span className="text-ink-faint">(optional)</span>
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-2 px-3.5 py-2.5">
                <Lock className="size-4 shrink-0 text-ink-faint" aria-hidden />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank for none"
                  className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="accent"
              className="w-full"
              onClick={async () => {
                const created = await createShareLink(fileId, {
                  expiresInDays: expiresInDays === "0" ? null : Number(expiresInDays),
                  maxDownloads: null,
                  password: password || null,
                });
                setLink(created);
              }}
            >
              Create link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
