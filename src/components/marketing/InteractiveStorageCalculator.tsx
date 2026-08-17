"use client";

import { useState } from "react";
import { FileText, Film, HardDrive, Image as ImageIcon, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";

export function InteractiveStorageCalculator() {
  const [gb, setGb] = useState<number>(25);

  const photosCount = Math.round((gb * 1024) / 3.5);
  const docsCount = Math.round((gb * 1024) / 1.2);
  const videoMinutes = Math.round((gb * 1024) / 25);

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20" id="calculator">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge>Interactive Estimator</Badge>
          <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            How much content can you store on Bongshai Cloud?
          </h2>
          <p className="mt-3 text-sm text-ink-muted sm:text-base">
            Drag the storage slider below to estimate how many photos, documents, and videos fit within your free 25GB quota.
          </p>
        </div>

        <GlassCard className="p-6 sm:p-8">
          {/* Slider Controls */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <HardDrive className="size-4 text-accent" />
                Select Storage Capacity
              </span>
              <span className="font-mono text-2xl font-bold text-accent sm:text-3xl">
                {gb} GB
              </span>
            </div>

            <input
              type="range"
              min={2}
              max={100}
              step={1}
              value={gb}
              onChange={(e) => setGb(Number(e.target.value))}
              aria-label="Storage Capacity Slider"
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-bg-3 accent-accent"
              data-mcp-action="adjust_storage_calculator"
              data-mcp-param-gb={gb}
            />

            <div className="flex justify-between font-mono text-xs text-ink-faint">
              <span>2 GB (Anonymous)</span>
              <span className="font-semibold text-accent">25 GB (Free Account)</span>
              <span>100 GB (Power User)</span>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-bg-2/50 p-5 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-2/10 text-accent-2">
                <ImageIcon className="size-5" />
              </span>
              <span className="font-mono text-2xl font-bold text-ink">
                {photosCount.toLocaleString()}
              </span>
              <span className="text-xs text-ink-muted">High-Res Photos (~3.5MB each)</span>
            </div>

            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-bg-2/50 p-5 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <FileText className="size-5" />
              </span>
              <span className="font-mono text-2xl font-bold text-ink">
                {docsCount.toLocaleString()}
              </span>
              <span className="text-xs text-ink-muted">PDFs &amp; Office Docs (~1.2MB each)</span>
            </div>

            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-bg-2/50 p-5 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-success/10 text-success">
                <Film className="size-5" />
              </span>
              <span className="font-mono text-2xl font-bold text-ink">
                {videoMinutes.toLocaleString()} min
              </span>
              <span className="text-xs text-ink-muted">1080p Video Footage (~25MB/min)</span>
            </div>
          </div>

          {/* Cost Comparison Callout */}
          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-accent/20 bg-accent/5 p-5 sm:flex-row">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                <Sparkles className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">
                  {gb <= 25 ? "100% Free Forever on Bongshai Cloud" : "Available via Affordable Add-On Packs"}
                </p>
                <p className="text-xs text-ink-muted">
                  No monthly credit card commitments for standard usage, with unthrottled download speeds.
                </p>
              </div>
            </div>

            <LinkButton href="/register" variant="accent" className="shrink-0 text-sm">
              Claim 25GB Free
            </LinkButton>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
