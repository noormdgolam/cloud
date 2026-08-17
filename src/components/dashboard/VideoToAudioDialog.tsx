"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { uploadFile } from "@/lib/client-upload";
import { decodeAudio, audioBufferToWav, audioBufferToMp3 } from "@/lib/audio-tools";

type Format = "mp3" | "wav";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VideoToAudioContent({
  fileId,
  fileName,
  folderId,
  onClose,
}: {
  fileId: string;
  fileName: string;
  folderId: string | null;
  onClose: () => void;
}) {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [saving, setSaving] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/files/${fileId}/download?inline=1`)
      .then((res) => res.arrayBuffer())
      .then(decodeAudio)
      .then((decoded) => {
        if (!cancelled) setBuffer(decoded);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't read an audio track out of this video.");
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  async function handleSave(format: Format) {
    if (!buffer) return;
    setSaving(format);
    setError(null);
    try {
      const blob = format === "mp3" ? audioBufferToMp3(buffer) : audioBufferToWav(buffer);
      const outName = `${fileName.replace(/\.[^.]+$/, "")}.${format}`;
      await uploadFile(new File([blob], outName, { type: blob.type }), folderId, () => {});
      onClose();
    } catch {
      setError(`Couldn't save the ${format.toUpperCase()}.`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      {!buffer ? (
        <p className="p-6 text-center text-sm text-ink-faint">{error ?? "Reading audio track…"}</p>
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            {formatTime(buffer.duration)} · {buffer.numberOfChannels === 1 ? "mono" : "stereo"} ·{" "}
            {buffer.sampleRate.toLocaleString()} Hz
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="accent"
              className="flex-1"
              disabled={saving !== null}
              onClick={() => handleSave("mp3")}
            >
              {saving === "mp3" ? "Encoding MP3…" : "Save as MP3"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              disabled={saving !== null}
              onClick={() => handleSave("wav")}
            >
              {saving === "wav" ? "Encoding WAV…" : "Save as WAV"}
            </Button>
          </div>

          {error && <p className="text-center text-xs text-danger">{error}</p>}
        </>
      )}
    </>
  );
}

export function VideoToAudioDialog({
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Extract audio from ${fileName}`} className="flex flex-col gap-4">
        {open && (
          <VideoToAudioContent
            key={fileId}
            fileId={fileId}
            fileName={fileName}
            folderId={folderId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
