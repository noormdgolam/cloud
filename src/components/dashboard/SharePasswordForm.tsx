"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { unlockShareLink } from "@/lib/actions/share-actions";
import { Button } from "@/components/ui/Button";

export function SharePasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-5 flex w-full flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await unlockShareLink(token, password);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Incorrect password.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-2 px-3.5 py-2.5">
        <Lock className="size-4 shrink-0 text-ink-faint" aria-hidden />
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" variant="accent" disabled={busy || !password} className="w-full">
        {busy ? "Checking…" : "Unlock"}
      </Button>
    </form>
  );
}
