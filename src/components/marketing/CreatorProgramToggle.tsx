"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { setCreatorProgramEnabled } from "@/lib/actions/creator-actions";

export function CreatorProgramToggle({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(enabled);

  async function toggle() {
    setBusy(true);
    try {
      await setCreatorProgramEnabled(!current);
      setCurrent(!current);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        variant={current ? "ghost" : "accent"}
        disabled={busy}
        onClick={toggle}
        className="px-5 py-2.5 text-sm"
        data-mcp-action="toggle_creator_program"
        data-mcp-param-state={current ? "leave" : "join"}
        data-mcp-description="Opt into or out of the Bongshai Cloud 100% ad-revenue creator sharing program"
      >
        {busy ? "Saving…" : current ? "Leave the program" : "Join the earn-money program"}
      </Button>
      {current && (
        <p className="text-xs text-ink-faint">
          Ads now show on all of your share-link pages, including ones you&apos;ve already sent out. Turn this off
          any time to stop them immediately.
        </p>
      )}
    </div>
  );
}
