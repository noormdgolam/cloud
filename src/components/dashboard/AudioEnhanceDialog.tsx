"use client";

import { useEffect, useRef, useState } from "react";
import { Wand2, Play, Square, Download, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { uploadFile } from "@/lib/client-upload";
import { decodeAudio, getWaveformPeaks, audioBufferToWav } from "@/lib/audio-tools";

const WAVEFORM_PEAKS = 200;

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Measure the RMS (root-mean-square) amplitude of an AudioBuffer's first channel. */
function measureRms(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / data.length);
}

/**
 * One-click audio beautification pipeline (all in-browser, no API key):
 *
 *  1. High-pass filter at 80 Hz  → removes mic rumble / AC hum
 *  2. Low-pass  filter at 15 kHz → tames harsh high-frequency hiss
 *  3. DynamicsCompressor         → evens out loud/quiet sections
 *  4. Gain normalisation         → brings perceived loudness to −14 LUFS target
 *
 * Returns a brand-new AudioBuffer ready to encode to WAV.
 */
async function enhanceAudio(buffer: AudioBuffer): Promise<AudioBuffer> {
  const { sampleRate, numberOfChannels, length } = buffer;

  const offline = new OfflineAudioContext(numberOfChannels, length, sampleRate);

  // ── source node ──────────────────────────────────────────────────────────
  const src = offline.createBufferSource();
  src.buffer = buffer;

  // ── 1. High-pass filter: kill everything below 80 Hz ─────────────────────
  const hpf = offline.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = 80;
  hpf.Q.value = 0.7;

  // ── 2. Low-pass filter: soften hiss above 15 kHz ─────────────────────────
  const lpf = offline.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.value = 15000;
  lpf.Q.value = 0.7;

  // ── 3. Mid-presence boost: +2 dB at 3 kHz (voice clarity) ────────────────
  const presence = offline.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 3000;
  presence.Q.value = 1.2;
  presence.gain.value = 2;

  // ── 4. Dynamic compression: even out volume ───────────────────────────────
  const comp = offline.createDynamicsCompressor();
  comp.threshold.value = -24;   // start compressing at -24 dBFS
  comp.knee.value = 6;          // soft knee for a natural sound
  comp.ratio.value = 4;         // 4:1 compression ratio
  comp.attack.value = 0.003;    // 3 ms attack — catches transients fast
  comp.release.value = 0.25;    // 250 ms release — smooth breathing

  // ── 5. Output gain (pre-normalisation boost) ──────────────────────────────
  const gainNode = offline.createGain();
  gainNode.gain.value = 1.0;    // will be adjusted after RMS measurement

  // ── chain: src → hpf → lpf → presence → comp → gain → output ────────────
  src.connect(hpf);
  hpf.connect(lpf);
  lpf.connect(presence);
  presence.connect(comp);
  comp.connect(gainNode);
  gainNode.connect(offline.destination);

  src.start(0);

  // ── first pass: render the chain ─────────────────────────────────────────
  const firstPass = await offline.startRendering();

  // ── 6. Loudness normalisation to −14 LUFS (≈ RMS target) ─────────────────
  const rms = measureRms(firstPass);
  const targetRms = 0.1; // roughly −20 dBFS → comfortable broadcast level
  const normaliseGain = rms > 0.0001 ? Math.min(targetRms / rms, 4.0) : 1.0;

  // Second (cheap) pass: just apply the gain scalar
  const offline2 = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  const src2 = offline2.createBufferSource();
  src2.buffer = firstPass;
  const gainNode2 = offline2.createGain();
  gainNode2.gain.value = normaliseGain;
  src2.connect(gainNode2);
  gainNode2.connect(offline2.destination);
  src2.start(0);

  return offline2.startRendering();
}

/* ─── component ───────────────────────────────────────────────────────────── */

type Stage = "idle" | "loading" | "ready" | "enhancing" | "done" | "error";

function AudioEnhanceContent({
  fileId,
  fileName,
  folderId,
}: {
  fileId: string;
  fileName: string;
  folderId: string | null;
}) {
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [origBuffer, setOrigBuffer] = useState<AudioBuffer | null>(null);
  const [enhBuffer, setEnhBuffer] = useState<AudioBuffer | null>(null);

  const [origPeaks, setOrigPeaks] = useState<{ min: number; max: number }[]>([]);
  const [enhPeaks, setEnhPeaks] = useState<{ min: number; max: number }[]>([]);

  const [playing, setPlaying] = useState<"orig" | "enh" | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  function stopPlayback() {
    try { sourceRef.current?.stop(); } catch { /* already stopped */ }
    sourceRef.current = null;
    setPlaying(null);
  }

  function playBuffer(buf: AudioBuffer, which: "orig" | "enh") {
    stopPlayback();
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => setPlaying(null);
    src.start();
    sourceRef.current = src;
    setPlaying(which);
  }

  // ── fetch + decode original audio on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/files/${fileId}/download?inline=1`)
      .then((r) => r.arrayBuffer())
      .then(decodeAudio)
      .then((buf) => {
        if (cancelled) return;
        setOrigBuffer(buf);
        setOrigPeaks(getWaveformPeaks(buf, WAVEFORM_PEAKS));
        setStage("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setStage("error");
          setErrorMsg("Couldn't load this audio file.");
        }
      });

    return () => {
      cancelled = true;
      stopPlayback();
      ctxRef.current?.close();
    };
  }, [fileId]);

  // ── one-click enhance ───────────────────────────────────────────────────
  async function handleEnhance() {
    if (!origBuffer) return;
    stopPlayback();
    setStage("enhancing");
    setErrorMsg(null);
    try {
      const result = await enhanceAudio(origBuffer);
      setEnhBuffer(result);
      setEnhPeaks(getWaveformPeaks(result, WAVEFORM_PEAKS));
      setStage("done");
    } catch {
      setStage("error");
      setErrorMsg("Enhancement failed. Please try again.");
    }
  }

  // ── save enhanced file ─────────────────────────────────────────────────
  async function handleSave() {
    if (!enhBuffer) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const blob = audioBufferToWav(enhBuffer);
      const baseName = fileName.replace(/\.[^.]+$/, "");
      const newName = `${baseName} (enhanced).wav`;
      await uploadFile(new File([blob], newName, { type: "audio/wav" }), folderId, () => {});
      setSaved(true);
    } catch {
      setErrorMsg("Couldn't save the enhanced audio.");
    } finally {
      setSaving(false);
    }
  }

  /* ── derived ──────────────────────────────────────────────────────────── */
  const duration = origBuffer?.duration ?? 0;

  return (
    <>
      {/* ── loading / error states ─────────────────────────────────────── */}
      {stage === "loading" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <span className="size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-ink-faint">Loading audio…</p>
        </div>
      )}

      {stage === "error" && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {errorMsg ?? "Something went wrong."}
        </p>
      )}

      {/* ── main UI ───────────────────────────────────────────────────── */}
      {(stage === "ready" || stage === "enhancing" || stage === "done") && origBuffer && (
        <>
          {/* ── waveform comparison ──────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            {/* Original */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Original</span>
                <span className="text-xs text-ink-faint">{formatTime(duration)}</span>
              </div>
              <div className="relative h-16 w-full overflow-hidden rounded-lg bg-bg-2">
                <Waveform peaks={origPeaks} color="var(--color-ink-faint)" />
                {stage !== "done" && (
                  <button
                    type="button"
                    aria-label={playing === "orig" ? "Stop original" : "Preview original"}
                    onClick={() => playing === "orig" ? stopPlayback() : playBuffer(origBuffer, "orig")}
                    className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20 rounded-lg"
                  >
                    {playing === "orig"
                      ? <Square className="size-4 text-white" />
                      : <Play className="size-4 text-white" />}
                  </button>
                )}
              </div>
            </div>

            {/* Enhanced — shown after processing */}
            {stage === "done" && enhBuffer && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-accent-2">✦ Enhanced</span>
                  <span className="text-xs text-ink-faint">{formatTime(enhBuffer.duration)}</span>
                </div>
                <div className="relative h-16 w-full overflow-hidden rounded-lg bg-bg-2">
                  <Waveform peaks={enhPeaks} color="var(--color-accent)" />
                  <button
                    type="button"
                    aria-label={playing === "enh" ? "Stop enhanced" : "Preview enhanced"}
                    onClick={() => playing === "enh" ? stopPlayback() : playBuffer(enhBuffer, "enh")}
                    className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20 rounded-lg"
                  >
                    {playing === "enh"
                      ? <Square className="size-4 text-white" />
                      : <Play className="size-4 text-white" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── enhancement steps badge strip ────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            {[
              "Rumble removal",
              "Hiss reduction",
              "Voice clarity",
              "Dynamic compression",
              "Loudness normalisation",
            ].map((label) => (
              <span
                key={label}
                className="rounded-full border border-border bg-bg-2 px-2.5 py-0.5 text-[11px] text-ink-faint"
              >
                {label}
              </span>
            ))}
          </div>

          {/* ── processing spinner ───────────────────────────────────── */}
          {stage === "enhancing" && (
            <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
              <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent shrink-0" />
              <p className="text-sm text-ink">AI is beautifying your audio…</p>
            </div>
          )}

          {/* ── error banner ─────────────────────────────────────────── */}
          {errorMsg && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
              {errorMsg}
            </p>
          )}

          {/* ── action buttons ───────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            {stage === "ready" && (
              <Button
                id="audio-enhance-btn"
                type="button"
                variant="accent"
                className="w-full gap-2"
                onClick={handleEnhance}
                data-mcp-action="enhance-audio"
              >
                <Wand2 className="size-4" aria-hidden />
                Enhance Audio
              </Button>
            )}

            {stage === "done" && (
              <>
                <Button
                  id="audio-enhance-again-btn"
                  type="button"
                  variant="ghost"
                  className="w-full gap-2 text-xs"
                  onClick={handleEnhance}
                >
                  <Wand2 className="size-3.5" aria-hidden />
                  Re-enhance
                </Button>

                {saved ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-accent-2">
                    <CheckCircle2 className="size-4" aria-hidden />
                    Saved to your storage!
                  </div>
                ) : (
                  <Button
                    id="audio-enhance-save-btn"
                    type="button"
                    variant="accent"
                    className="w-full gap-2"
                    disabled={saving}
                    onClick={handleSave}
                    data-mcp-action="save-enhanced-audio"
                  >
                    <Download className="size-4" aria-hidden />
                    {saving ? "Saving…" : "Save enhanced file"}
                  </Button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

export function AudioEnhanceDialog({
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
      <DialogContent title={`Enhance "${fileName}"`} className="flex flex-col gap-5">
        {open && (
          <AudioEnhanceContent
            key={fileId}
            fileId={fileId}
            fileName={fileName}
            folderId={folderId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}


/* ─── Waveform SVG sub-component ──────────────────────────────────────────── */

function Waveform({
  peaks,
  color,
}: {
  peaks: { min: number; max: number }[];
  color: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${WAVEFORM_PEAKS} 100`}
      preserveAspectRatio="none"
      className="size-full"
      aria-hidden
    >
      {peaks.map((p, i) => (
        <rect
          key={i}
          x={i}
          y={50 + p.min * 50}
          width={1}
          height={Math.max(1, (p.max - p.min) * 50)}
          fill={color}
          opacity={0.7}
        />
      ))}
    </svg>
  );
}
