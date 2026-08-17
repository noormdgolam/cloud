"use client";

import { getGoogleAccessToken } from "./auth";

const PHOTOS_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
const PHOTOS_API_BASE = "https://photospicker.googleapis.com/v1";
const MAX_IMPORT_BYTES = 750 * 1024 * 1024;
const DEFAULT_POLL_INTERVAL_MS = 3000;
const MAX_POLL_MS = 5 * 60 * 1000; // hard timeout — an abandoned session can't poll forever

type MediaItem = {
  id: string;
  type: "PHOTO" | "VIDEO";
  mediaFile: { baseUrl: string; mimeType: string; filename: string };
};

export class PhotosPickerCancelled extends Error {
  constructor() {
    super("Cancelled.");
    this.name = "PhotosPickerCancelled";
  }
}

async function photosApi(token: string, path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${PHOTOS_API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Google Photos request failed (${res.status}).`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export type PhotosPickerStart = { sessionId: string; token: string; pickerUri: string; windowOpened: boolean };

// 520x680 fixed size read as a cramped popup on real desktop screens
// (confirmed via screenshot) — scale to the actual screen instead, capped
// so it doesn't take over an ultrawide monitor.
function popupFeatures(): string {
  const width = Math.min(1000, Math.round(window.screen.width * 0.9));
  const height = Math.min(800, Math.round(window.screen.height * 0.9));
  const left = Math.round((window.screen.width - width) / 2);
  const top = Math.round((window.screen.height - height) / 2);
  return `width=${width},height=${height},left=${left},top=${top}`;
}

/**
 * Requests an access token (letting Google Identity Services use its own
 * popup for consent — this must be the ONLY popup open at that point, since
 * Chrome blocks a second popup opened in the same click even when the first
 * one succeeded, which is exactly what broke the old
 * open-a-blank-window-up-front approach), creates a picker session, then
 * tries to open the real picker URL. If that window.open is blocked (real
 * async time has passed since the click by now, so this one isn't
 * guaranteed), the caller falls back to a manual "open" button — a fresh
 * click is always a trusted gesture.
 */
export async function startPhotosPicker(): Promise<PhotosPickerStart> {
  const token = await getGoogleAccessToken([PHOTOS_SCOPE]);
  const session = await photosApi(token, "/sessions", { method: "POST", body: "{}" });
  const sessionId = session.id as string;
  const pickerUri = session.pickerUri as string;

  const popup = window.open(pickerUri, "_blank", popupFeatures());
  return { sessionId, token, pickerUri, windowOpened: popup !== null && !popup.closed };
}

/** Same as the window.open attempt inside startPhotosPicker, but triggered
 * directly from a user click on the fallback "Open Google Photos" button —
 * always a trusted gesture, so this always succeeds. */
export function openPhotosPickerManually(pickerUri: string): void {
  window.open(pickerUri, "_blank", popupFeatures());
}

/**
 * Polls the given session until the user finishes selecting (or the signal
 * aborts / hard timeout elapses), then downloads whatever was picked.
 * Doesn't care whether the picker window opened automatically or the user
 * opened it manually via the fallback button — polling only depends on the
 * session, not the window.
 */
export async function waitForPhotosSelection(
  sessionId: string,
  token: string,
  options?: { signal?: AbortSignal }
): Promise<{ files: File[]; skipped: { name: string; reason: string }[] }> {
  const deadline = Date.now() + MAX_POLL_MS;
  let mediaItemsSet = false;
  while (!mediaItemsSet) {
    if (options?.signal?.aborted) throw new PhotosPickerCancelled();
    if (Date.now() > deadline) throw new Error("Timed out waiting for a Google Photos selection.");

    const polled = await photosApi(token, `/sessions/${sessionId}`);
    mediaItemsSet = Boolean(polled.mediaItemsSet);
    if (mediaItemsSet) break;

    const pollIntervalMs = Number((polled.pollingConfig as Record<string, unknown> | undefined)?.pollInterval) || DEFAULT_POLL_INTERVAL_MS;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const list = await photosApi(token, `/mediaItems?sessionId=${encodeURIComponent(sessionId)}`);
  const items = (list.mediaItems as MediaItem[] | undefined) ?? [];

  const files: File[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const item of items) {
    const suffix = item.type === "VIDEO" ? "=dv" : "=d";
    const res = await fetch(`${item.mediaFile.baseUrl}${suffix}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      skipped.push({ name: item.mediaFile.filename, reason: "Couldn't download this item from Google Photos." });
      continue;
    }
    const blob = await res.blob();
    if (blob.size > MAX_IMPORT_BYTES) {
      skipped.push({ name: item.mediaFile.filename, reason: `Too large to import here (over ${Math.round(MAX_IMPORT_BYTES / (1024 * 1024))}MB).` });
      continue;
    }
    files.push(new File([blob], item.mediaFile.filename, { type: item.mediaFile.mimeType || blob.type }));
  }

  await photosApi(token, `/sessions/${sessionId}`, { method: "DELETE" }).catch(() => {});

  return { files, skipped };
}
