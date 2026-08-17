"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { publishReel } from "@/lib/actions/reel-actions";

export function PublishReelDialog({
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    try {
      await publishReel(fileId, formData);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't publish this reel.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setDone(false);
      }}
    >
      <DialogContent title={`Publish "${fileName}" to Reels`} description="Makes this video public in the /reels feed — anyone can watch it, no account needed.">
        {done ? (
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm text-ink">Published! It&apos;s now live in the reels feed.</p>
            <Link href="/reels" className="text-sm text-accent hover:underline">
              View the feed
            </Link>
          </div>
        ) : (
          <form action={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="caption">Caption (optional)</Label>
              <Input id="caption" name="caption" placeholder="Say something about it" maxLength={500} autoFocus />
            </div>
            {error && (
              <p className="text-xs text-danger">
                {error}{" "}
                {error.includes("earn-money") && (
                  <Link href="/earn" className="underline">
                    Join now
                  </Link>
                )}
              </p>
            )}
            <Button type="submit" variant="accent" className="w-full" disabled={saving}>
              {saving ? "Publishing…" : "Publish to Reels"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
