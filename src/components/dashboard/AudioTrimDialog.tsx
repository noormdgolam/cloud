"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { uploadFile } from "@/lib/client-upload";
import { decodeAudio, getWaveformPeaks, trimAudioBuffer, audioBufferToWav } from "@/lib/audio-tools";

const WAVEFORM_PEAKS = 200;

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioTrimDialog({
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
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<{ min: number; max: number }[]>([]);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/files/${fileId}/download?inline=1`)
      .then((res) => res.arrayBuffer())
      .then(decodeAudio)
      .then((decoded) => {
        if (cancelled) return;
        setBuffer(decoded);
        setPeaks(getWaveformPeaks(decoded, WAVEFORM_PEAKS));
        setStart(0);
        setEnd(decoded.duration);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this audio file.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, fileId]);

  useEffect(() => {
    // Stop playback and release the audio context when the dialog closes —
    // otherwise a playing preview keeps running after the user navigates away.
    if (!open) {
      sourceRef.current?.stop();
      playbackCtxRef.current?.close();
    }
  }, [open]);

  function stopPreview() {
    sourceRef.current?.stop();
    sourceRef.current = null;
    setPlaying(false);
  }

  function playPreview() {
    if (!buffer) return;
    stopPreview();
    const ctx = new AudioContext();
    playbackCtxRef.current = ctx;
    const trimmed = trimAudioBuffer(buffer, start, end);
    const source = ctx.createBufferSource();
    source.buffer = trimmed;
    source.connect(ctx.destination);
    source.onended = () => setPlaying(false);
    source.start();
    sourceRef.current = source;
    setPlaying(true);
  }

  async function handleSave() {
    if (!buffer) return;
    setSaving(true);
    setError(null);
    try {
      const trimmed = trimAudioBuffer(buffer, start, end);
      const blob = audioBufferToWav(trimmed);
      const trimmedName = `${fileName.replace(/\.[^.]+$/, "")} (trimmed).wav`;
      await uploadFile(new File([blob], trimmedName, { type: "audio/wav" }), folderId, () => {});
      onOpenChange(false);
    } catch {
      setError("Couldn't save the trimmed audio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Trim ${fileName}`} className="flex flex-col gap-4">
        {!buffer ? (
          <p className="p-6 text-center text-sm text-ink-faint">{error ?? "Loading…"}</p>
        ) : (
          <>
            <div className="relative h-20 w-full overflow-hidden rounded-lg bg-bg-2">
              <svg viewBox={`0 0 ${WAVEFORM_PEAKS} 100`} preserveAspectRatio="none" className="size-full">
                {peaks.map((p, i) => (
                  <rect
                    key={i}
                    x={i}
                    y={50 + p.min * 50}
                    width={1}
                    height={Math.max(1, (p.max - p.min) * 50)}
                    className="fill-accent/60"
                  />
                ))}
              </svg>
              <div
                className="pointer-events-none absolute inset-y-0 bg-accent/15"
                style={{
                  left: `${(start / buffer.duration) * 100}%`,
                  width: `${((end - start) / buffer.duration) * 100}%`,
                }}
              />
            </div>

            <div className="flex flex-col gap-2 text-xs text-ink-muted">
              <label className="flex flex-col gap-1">
                Start ({formatTime(start)})
                <input
                  type="range"
                  min={0}
                  max={buffer.duration}
                  step={0.1}
                  value={start}
                  onChange={(e) => setStart(Math.min(Number(e.target.value), end - 0.1))}
                />
              </label>
              <label className="flex flex-col gap-1">
                End ({formatTime(end)})
                <input
                  type="range"
                  min={0}
                  max={buffer.duration}
                  step={0.1}
                  value={end}
                  onChange={(e) => setEnd(Math.max(Number(e.target.value), start + 0.1))}
                />
              </label>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Button type="button" variant="ghost" className="px-4 py-2 text-xs" onClick={playing ? stopPreview : playPreview}>
                {playing ? <Square className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
                {playing ? "Stop" : "Preview"}
              </Button>
            </div>

            {error && <p className="text-center text-xs text-danger">{error}</p>}

            <Button type="button" variant="accent" className="w-full" disabled={saving} onClick={handleSave}>
              {saving ? "Saving…" : "Save trimmed clip"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
