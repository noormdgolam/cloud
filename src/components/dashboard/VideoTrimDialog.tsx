"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { uploadFile } from "@/lib/client-upload";
import { trimVideo } from "@/lib/video-tools";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoTrimDialog({
  fileId,
  fileName,
  folderId,
  open,
  onOpenChange,
}: {
  fileId: string;
  fileName: string;
  folderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [duration, setDuration] = useState<number | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [trimming, setTrimming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDuration(null);
      setError(null);
    }
  }, [open]);

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setStart(0);
    setEnd(video.duration);
  }

  async function handleSave() {
    const video = videoRef.current;
    if (!video || !duration) return;
    setTrimming(true);
    setProgress(0);
    setError(null);
    try {
      const blob = await trimVideo(video, start, end, setProgress);
      const trimmedName = `${fileName.replace(/\.[^.]+$/, "")} (trimmed).webm`;
      await uploadFile(new File([blob], trimmedName, { type: blob.type || "video/webm" }), folderId, () => {});
      onOpenChange(false);
    } catch {
      setError("Couldn't trim this video. Try a shorter range or a different browser.");
    } finally {
      setTrimming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Trim ${fileName}`}
        description="Cuts a clip from the video, re-encoded from real-time playback — takes about as long as the clip itself."
        className="flex flex-col gap-4"
      >
        <video
          ref={videoRef}
          src={open ? `/api/files/${fileId}/download?inline=1` : undefined}
          onLoadedMetadata={handleLoadedMetadata}
          controls={!trimming}
          className="w-full rounded-lg bg-black"
        />

        {duration === null ? (
          <p className="text-center text-xs text-ink-faint">{error ?? "Loading…"}</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 text-xs text-ink-muted">
              <label className="flex flex-col gap-1">
                Start ({formatTime(start)})
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={start}
                  disabled={trimming}
                  onChange={(e) => setStart(Math.min(Number(e.target.value), end - 0.5))}
                />
              </label>
              <label className="flex flex-col gap-1">
                End ({formatTime(end)})
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={end}
                  disabled={trimming}
                  onChange={(e) => setEnd(Math.max(Number(e.target.value), start + 0.5))}
                />
              </label>
              <p>Clip length: ~{formatTime(end - start)}</p>
            </div>

            {trimming && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-2">
                <div className="h-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}

            {error && <p className="text-center text-xs text-danger">{error}</p>}

            <Button type="button" variant="accent" className="w-full" disabled={trimming} onClick={handleSave}>
              {trimming ? `Trimming… ${Math.round(progress * 100)}%` : "Save trimmed clip"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
