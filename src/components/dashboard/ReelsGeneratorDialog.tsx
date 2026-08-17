"use client";

import { useEffect, useState } from "react";
import { Music, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { uploadFile } from "@/lib/client-upload";
import { decodeAudio } from "@/lib/audio-tools";
import { generateReelVideo, type ReelSlide } from "@/lib/reels-generator";
import { FilePickerDialog } from "./FilePickerDialog";
import type { PickerFile } from "@/lib/actions/file-actions";

type SlideInput = { image: HTMLImageElement; caption: string; durationSec: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function ReelsGeneratorDialog({
  fileIds,
  folderId,
  open,
  onOpenChange,
  onDone,
}: {
  fileIds: string[];
  folderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [slides, setSlides] = useState<SlideInput[] | null>(null);
  const [musicTrack, setMusicTrack] = useState<PickerFile | null>(null);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all(
      fileIds.map(async (id) => {
        const image = await loadImage(`/api/files/${id}/download?inline=1`);
        return { image, caption: "", durationSec: 3 };
      })
    ).then((loaded) => {
      if (!cancelled) setSlides(loaded);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fileIds.join(",")]);

  function updateSlide(index: number, patch: Partial<SlideInput>) {
    setSlides((prev) => (prev ? prev.map((s, i) => (i === index ? { ...s, ...patch } : s)) : prev));
  }

  async function handleGenerate() {
    if (!slides || slides.length === 0) return;
    setGenerating(true);
    setError(null);
    setProgress(0);
    try {
      let audioBuffer = null;
      if (musicTrack) {
        const bytes = await fetch(`/api/files/${musicTrack.id}/download?inline=1`).then((r) => r.arrayBuffer());
        audioBuffer = await decodeAudio(bytes);
      }
      const reelSlides: ReelSlide[] = slides.map((s) => ({ image: s.image, caption: s.caption, durationSec: s.durationSec }));
      const blob = await generateReelVideo(reelSlides, audioBuffer, setProgress);

      setGenerating(false);
      setUploading(true);
      const file = new File([blob], "My reel.webm", { type: blob.type || "video/webm" });
      await uploadFile(file, folderId, () => {});
      setDone(true);
      onDone();
    } catch {
      setError("Couldn't generate the reel. Try fewer/smaller images, or a shorter music track.");
    } finally {
      setGenerating(false);
      setUploading(false);
    }
  }

  const totalDuration = slides?.reduce((sum, s) => sum + s.durationSec, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Create a reel"
        description="Combine your images into one video with captions and background music — rendered right in your browser."
        className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-4 overflow-y-auto p-4"
      >
        {!slides ? (
          <p className="p-10 text-center text-sm text-ink-faint">Loading images…</p>
        ) : done ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm text-ink">Your reel is saved to your files.</p>
            <p className="text-xs text-ink-faint">
              Open it from your file list and choose &quot;Publish to Reels&quot; to make it public.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {slides.map((slide, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary user-uploaded content, not a build-time-known asset */}
                  <img
                    src={slide.image.src}
                    alt=""
                    className="size-16 shrink-0 rounded-lg object-cover"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Input
                      value={slide.caption}
                      onChange={(e) => updateSlide(i, { caption: e.target.value })}
                      placeholder={`Caption for image ${i + 1} (optional)`}
                      maxLength={120}
                    />
                    <label className="flex items-center gap-2 text-xs text-ink-muted">
                      Show for
                      <input
                        type="number"
                        min={1}
                        max={15}
                        step={0.5}
                        value={slide.durationSec}
                        onChange={(e) => updateSlide(i, { durationSec: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-16 rounded-lg border border-border bg-bg-2 px-2 py-1 text-ink"
                      />
                      seconds
                    </label>
                  </div>
                </div>
              ))}
              <p className="text-center text-xs text-ink-faint">Total length: ~{totalDuration.toFixed(1)}s</p>
            </div>

            <div className="rounded-xl border border-border p-3">
              {musicTrack ? (
                <div className="flex items-center gap-2 text-sm">
                  <Music className="size-4 shrink-0 text-accent-2" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-ink">{musicTrack.name}</span>
                  <button type="button" onClick={() => setMusicTrack(null)} className="text-ink-faint hover:text-ink">
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMusicPickerOpen(true)}
                  className="flex w-full items-center justify-center gap-2 text-sm text-ink-muted hover:text-ink"
                >
                  <Music className="size-4" aria-hidden />
                  Add background music (optional)
                </button>
              )}
            </div>

            {error && <p className="text-center text-xs text-danger">{error}</p>}

            {(generating || uploading) && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-2">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${uploading ? 100 : Math.round(progress * 100)}%` }}
                />
              </div>
            )}

            <Button type="button" variant="accent" className="w-full" disabled={generating || uploading} onClick={handleGenerate}>
              {uploading ? "Saving…" : generating ? `Rendering… ${Math.round(progress * 100)}%` : "Generate reel"}
            </Button>
          </>
        )}
      </DialogContent>

      <FilePickerDialog
        title="Pick background music"
        accept={(m) => m.startsWith("audio/")}
        open={musicPickerOpen}
        onOpenChange={setMusicPickerOpen}
        onSelect={(files) => setMusicTrack(files[0] ?? null)}
      />
    </Dialog>
  );
}
