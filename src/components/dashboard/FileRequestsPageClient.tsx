"use client";

import { useState } from "react";
import { Plus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { CreateFileRequestDialog } from "./CreateFileRequestDialog";
import { FileRequestRow } from "./FileRequestRow";
import type { FileRequestListItem } from "@/lib/data/file-requests";

export function FileRequestsPageClient({ requests }: { requests: FileRequestListItem[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">File requests</h1>
          <p className="mt-1 text-sm text-ink-muted">Links that let anyone drop files into your storage — no account needed on their end.</p>
        </div>
        <Button type="button" variant="accent" className="shrink-0 px-4 py-2 text-sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          New request
        </Button>
      </div>

      {requests.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full border border-border bg-bg-2">
            <Link2 className="size-5 text-ink-faint" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="text-sm text-ink-muted">No file requests yet. Create one to start collecting files.</p>
        </div>
      ) : (
        <GlassCard className="flex flex-col gap-0.5 p-2">
          {requests.map((r) => (
            <FileRequestRow key={r.id} request={r} />
          ))}
        </GlassCard>
      )}

      <CreateFileRequestDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
