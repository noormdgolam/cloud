"use client";

const WIDTH = 720;
const HEIGHT = 1280; // 9:16, matches the /reels feed's portrait video tiles
const FPS = 30;

export type ReelSlide = { image: HTMLImageElement; caption: string; durationSec: number };

function pickSupportedMimeType(): string {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "video/webm";
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);

  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * lineHeight));
}

function drawSlide(ctx: CanvasRenderingContext2D, slide: ReelSlide) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const scale = Math.max(WIDTH / slide.image.naturalWidth, HEIGHT / slide.image.naturalHeight);
  const dw = slide.image.naturalWidth * scale;
  const dh = slide.image.naturalHeight * scale;
  ctx.drawImage(slide.image, (WIDTH - dw) / 2, (HEIGHT - dh) / 2, dw, dh);

  if (slide.caption.trim()) {
    const barHeight = 180;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, HEIGHT - barHeight, WIDTH, barHeight);
    ctx.fillStyle = "#fff";
    ctx.font = "600 40px system-ui, sans-serif";
    ctx.textAlign = "center";
    wrapText(ctx, slide.caption, WIDTH / 2, HEIGHT - barHeight / 2, WIDTH - 80, 50);
  }
}

/**
 * Renders a sequence of images (each with an optional caption, held for its
 * own duration) into a single video, entirely in the browser — Canvas 2D for
 * the frames, canvas.captureStream() + MediaRecorder for encoding, and the
 * Web Audio API to mix in an optional background track. No server-side
 * video processing, no ffmpeg, no external service.
 */
export async function generateReelVideo(
  slides: ReelSlide[],
  audioBuffer: AudioBuffer | null,
  onProgress?: (fraction: number) => void
): Promise<Blob> {
  if (slides.length === 0) throw new Error("Add at least one image.");

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  const canvasStream = canvas.captureStream(FPS);

  let audioCtx: AudioContext | null = null;
  let audioSource: AudioBufferSourceNode | null = null;
  if (audioBuffer) {
    audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();
    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(destination);
    const audioTrack = destination.stream.getAudioTracks()[0];
    if (audioTrack) canvasStream.addTrack(audioTrack);
  }

  const mimeType = pickSupportedMimeType();
  const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const totalDuration = slides.reduce((sum, s) => sum + s.durationSec, 0);
  const frameDelayMs = 1000 / FPS;

  return new Promise((resolve, reject) => {
    let stopped = false;
    const cleanup = () => {
      audioSource?.stop();
      audioCtx?.close().catch(() => {});
    };

    recorder.onstop = () => {
      cleanup();
      resolve(new Blob(chunks, { type: mimeType }));
    };
    recorder.onerror = (e) => {
      cleanup();
      reject((e as unknown as { error?: Error }).error ?? new Error("Recording failed."));
    };

    recorder.start();
    audioSource?.start();

    let elapsed = 0;

    function tick() {
      if (stopped) return;

      let slideStart = 0;
      let slide = slides[slides.length - 1];
      for (const s of slides) {
        if (elapsed < slideStart + s.durationSec) {
          slide = s;
          break;
        }
        slideStart += s.durationSec;
      }
      drawSlide(ctx!, slide);
      onProgress?.(Math.min(1, elapsed / totalDuration));

      elapsed += frameDelayMs / 1000;

      if (elapsed >= totalDuration) {
        stopped = true;
        onProgress?.(1);
        setTimeout(() => recorder.stop(), 150);
        return;
      }
      setTimeout(tick, frameDelayMs);
    }
    tick();
  });
}
