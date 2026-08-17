"use client";

import { Mp3Encoder } from "@breezystack/lamejs";

export async function decodeAudio(bytes: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    // decodeAudioData detaches/consumes the buffer, so hand it a copy —
    // callers may want the original bytes again (e.g. re-decoding on retry).
    return await ctx.decodeAudioData(bytes.slice(0));
  } finally {
    ctx.close();
  }
}

// Downsamples to `numPeaks` min/max amplitude pairs for a static waveform
// preview — cheap enough to run on the main thread for typical file sizes.
export function getWaveformPeaks(buffer: AudioBuffer, numPeaks: number): { min: number; max: number }[] {
  const data = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(data.length / numPeaks));
  const peaks: { min: number; max: number }[] = [];
  for (let i = 0; i < numPeaks; i++) {
    const start = i * blockSize;
    let min = 0;
    let max = 0;
    for (let j = start; j < start + blockSize && j < data.length; j++) {
      const v = data[j];
      if (v > max) max = v;
      if (v < min) min = v;
    }
    peaks.push({ min, max });
  }
  return peaks;
}

export function trimAudioBuffer(buffer: AudioBuffer, startSec: number, endSec: number): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(endSec * sampleRate));
  const frameCount = Math.max(1, endSample - startSample);

  const ctx = new OfflineAudioContext(buffer.numberOfChannels, frameCount, sampleRate);
  const trimmed = ctx.createBuffer(buffer.numberOfChannels, frameCount, sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    trimmed.copyToChannel(buffer.getChannelData(ch).subarray(startSample, startSample + frameCount), ch);
  }
  return trimmed;
}

// Manual 16-bit PCM WAV encoding — no library needed, WAV is just a RIFF
// header in front of raw interleaved samples.
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frameCount = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = frameCount * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function floatTo16BitPCM(data: Float32Array): Int16Array {
  const out = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return out;
}

// lamejs (pure-JS libmp3lame port) — no server round trip, encodes at many
// times realtime speed in-browser. 1152 samples/block per lamejs's own docs
// (a multiple of the encoder's 576-sample granule size).
const MP3_BLOCK_SIZE = 1152;

export function audioBufferToMp3(buffer: AudioBuffer, kbps = 128): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const encoder = new Mp3Encoder(numChannels, buffer.sampleRate, kbps);
  const left = floatTo16BitPCM(buffer.getChannelData(0));
  const right = numChannels === 2 ? floatTo16BitPCM(buffer.getChannelData(1)) : undefined;

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += MP3_BLOCK_SIZE) {
    const leftChunk = left.subarray(i, i + MP3_BLOCK_SIZE);
    const rightChunk = right?.subarray(i, i + MP3_BLOCK_SIZE);
    const encoded = encoder.encodeBuffer(leftChunk, rightChunk);
    if (encoded.length > 0) chunks.push(encoded);
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(tail);

  return new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
}
