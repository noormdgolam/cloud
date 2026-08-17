"use client";

/// <reference path="./google-globals.d.ts" />

import { getGoogleAccessToken, getGoogleImportConfig } from "./auth";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
// Comfortably under the ~1-1.5GB per-tab memory ceiling observed on mobile
// Safari for a single in-memory Blob (fetch().blob() has no streaming/
// partial mode — the whole file is held in memory before it resolves).
const MAX_IMPORT_BYTES = 750 * 1024 * 1024;
const NATIVE_GOOGLE_MIME_PREFIX = "application/vnd.google-apps.";
const FOLDER_MIME = "application/vnd.google-apps.folder";
// A picked folder can legitimately contain thousands of files — this caps
// one import run so a single accidental "select all" on a huge folder
// doesn't hang the tab or blow through Drive's read quota in one go.
const MAX_FILES_PER_IMPORT = 500;

let pickerApiLoadPromise: Promise<void> | null = null;

function loadPickerApi(): Promise<void> {
  if (pickerApiLoadPromise) return pickerApiLoadPromise;
  pickerApiLoadPromise = new Promise((resolve, reject) => {
    const start = () => {
      window.gapi!.load("picker", () => resolve());
    };
    if (window.gapi) {
      start();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = start;
    script.onerror = () => reject(new Error("Couldn't load the Google Picker."));
    document.head.appendChild(script);
  });
  return pickerApiLoadPromise;
}

export type SkippedDriveFile = { name: string; reason: string };
type DrivePick = { id: string; name: string; mimeType: string; sizeBytes: number };

// Picker-granted folder access under the `drive.file` scope extends to that
// folder's contents (this is the documented, supported reason
// setSelectFolderEnabled exists) — so a plain files.list scoped to the
// folder's id works without any broader scope.
async function listFolderRecursive(token: string, folderId: string, budget: { remaining: number }): Promise<DrivePick[]> {
  const out: DrivePick[] = [];
  let pageToken: string | undefined;
  do {
    if (budget.remaining <= 0) break;
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, size)",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) break;
    const data = (await res.json()) as { files?: { id: string; name: string; mimeType: string; size?: string }[]; nextPageToken?: string };
    for (const f of data.files ?? []) {
      if (budget.remaining <= 0) break;
      if (f.mimeType === FOLDER_MIME) {
        const nested = await listFolderRecursive(token, f.id, budget);
        out.push(...nested);
      } else {
        out.push({ id: f.id, name: f.name, mimeType: f.mimeType, sizeBytes: f.size ? Number(f.size) : 0 });
        budget.remaining -= 1;
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

/** Opens the Drive picker (multi-select, folders included), downloads
 * whatever binary files the user selects — expanding any picked folders
 * into their full contents first — and returns them as real File objects
 * ready for the existing upload pipeline. Native Google Docs/Sheets/Slides
 * (no binary content to download via alt=media) and anything over the size
 * cap are skipped, not silently dropped — the caller decides how to surface
 * `skipped` to the user. */
export async function pickFromDrive(): Promise<{ files: File[]; skipped: SkippedDriveFile[] }> {
  const [token, config] = await Promise.all([getGoogleAccessToken([DRIVE_SCOPE]), getGoogleImportConfig()]);
  await loadPickerApi();

  const picked = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const picker = window.google!.picker!;
    const view = new picker.DocsView(picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(true);
    const builder = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.projectNumber)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setCallback((data) => {
        const action = data[picker.Response.ACTION];
        // The callback fires more than once — first with LOADED as soon as
        // the widget finishes rendering, well before the user has picked
        // anything. Only PICKED/CANCEL are terminal; anything else that
        // isn't LOADED is a genuine failure.
        if (action === picker.Action.PICKED) resolve(data);
        else if (action === picker.Action.CANCEL) resolve({});
        else if (action === picker.Action.LOADED) return;
        else reject(new Error("Drive picker failed."));
      })
      .build();
    builder.setVisible(true);
  });

  const picker = window.google!.picker!;
  const docs = (picked[picker.Response.DOCUMENTS] as Record<string, unknown>[] | undefined) ?? [];

  const skipped: SkippedDriveFile[] = [];
  const budget = { remaining: MAX_FILES_PER_IMPORT };
  const flat: DrivePick[] = [];

  for (const doc of docs) {
    const id = doc[picker.Document.ID] as string;
    const name = doc[picker.Document.NAME] as string;
    const mimeType = doc[picker.Document.MIME_TYPE] as string;
    const sizeBytes = Number(doc[picker.Document.SIZE_BYTES] ?? 0);

    if (mimeType === FOLDER_MIME) {
      if (budget.remaining <= 0) {
        skipped.push({ name, reason: `Skipped — already at the ${MAX_FILES_PER_IMPORT}-file import limit for one run.` });
        continue;
      }
      flat.push(...(await listFolderRecursive(token, id, budget)));
    } else {
      flat.push({ id, name, mimeType, sizeBytes });
    }
  }

  const files: File[] = [];

  for (const item of flat) {
    if (item.mimeType?.startsWith(NATIVE_GOOGLE_MIME_PREFIX)) {
      skipped.push({ name: item.name, reason: "Google Docs/Sheets/Slides can't be imported directly — export it to PDF or Word in Drive first, then import that." });
      continue;
    }
    if (item.sizeBytes > MAX_IMPORT_BYTES) {
      skipped.push({ name: item.name, reason: `Too large to import here (over ${Math.round(MAX_IMPORT_BYTES / (1024 * 1024))}MB).` });
      continue;
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      skipped.push({ name: item.name, reason: "Couldn't download this file from Drive." });
      continue;
    }
    const blob = await res.blob();
    files.push(new File([blob], item.name, { type: item.mimeType || blob.type }));
  }

  return { files, skipped };
}
