"use client";

// Real-time capture, not instant re-encoding — there's no client-side API to
// randomly slice a compressed video the way trimAudioBuffer slices decoded
// PCM samples. Same technique already proven in reels-generator.ts:
// captureStream() + MediaRecorder, just capturing the video element's own
// live playback (video+audio together) instead of a canvas. Trimming a
// 30s clip takes ~30s of real wall-clock time — the caller shows a
// progress bar keyed off video.currentTime, not a fake spinner.
function pickSupportedMimeType(): string {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "video/webm";
}

type CaptureableVideo = HTMLVideoElement & { captureStream: () => MediaStream };

export async function trimVideo(
  videoEl: HTMLVideoElement,
  startSec: number,
  endSec: number,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const captureable = videoEl as CaptureableVideo;
  if (typeof captureable.captureStream !== "function") {
    throw new Error("This browser can't capture video playback (captureStream unsupported).");
  }

  const stream = captureable.captureStream();
  const mimeType = pickSupportedMimeType();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      videoEl.removeEventListener("timeupdate", onTimeUpdate);
      videoEl.removeEventListener("error", onVideoError);
    };

    const onTimeUpdate = () => {
      if (settled) return;
      onProgress?.(Math.min(1, Math.max(0, (videoEl.currentTime - startSec) / (endSec - startSec))));
      if (videoEl.currentTime >= endSec) {
        settled = true;
        videoEl.pause();
        recorder.stop();
      }
    };

    const onVideoError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Video playback error during trim."));
    };

    recorder.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Recording error during trim."));
    };

    recorder.onstop = () => {
      cleanup();
      resolve(new Blob(chunks, { type: mimeType }));
    };

    videoEl.addEventListener("timeupdate", onTimeUpdate);
    videoEl.addEventListener("error", onVideoError);

    videoEl.currentTime = startSec;
    videoEl.onseeked = () => {
      videoEl.onseeked = null;
      recorder.start();
      videoEl.play().catch(reject);
    };
  });
}
