"use client";

const SINGLE_SHOT_LIMIT = 100 * 1024 * 1024; // must match MAX_SINGLE_SHOT_BYTES in api/upload/route.ts
const CHUNK_SIZE = 8 * 1024 * 1024;

function uploadSingleShot(
  file: File,
  folderId: string | null,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = folderId ? `/api/upload?folderId=${encodeURIComponent(folderId)}` : "/api/upload";
    xhr.open("POST", url);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(parseXhrError(xhr)));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

function putChunk(url: string, blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(parseXhrError(xhr)));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));
    xhr.send(blob);
  });
}

async function uploadChunked(
  file: File,
  folderId: string | null,
  onProgress: (pct: number) => void
): Promise<void> {
  const initRes = await fetch("/api/upload/init", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      totalSize: file.size,
      folderId,
    }),
  });
  if (!initRes.ok) {
    const body = await initRes.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not start upload.");
  }
  const { uploadId } = await initRes.json();

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const blob = file.slice(start, start + CHUNK_SIZE);
    await putChunk(`/api/upload/chunk?uploadId=${uploadId}&chunkIndex=${i}`, blob);
    onProgress(Math.round(((i + 1) / totalChunks) * 95)); // reserve the last 5% for assembly
  }

  const completeRes = await fetch("/api/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
    body: JSON.stringify({ uploadId, totalChunks }),
  });
  if (!completeRes.ok) {
    const body = await completeRes.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not finish upload.");
  }
  onProgress(100);
}

function parseXhrError(xhr: XMLHttpRequest): string {
  try {
    const body = JSON.parse(xhr.responseText);
    return body.error ?? `Upload failed (${xhr.status}).`;
  } catch {
    return `Upload failed (${xhr.status}).`;
  }
}

export function uploadFile(
  file: File,
  folderId: string | null,
  onProgress: (pct: number) => void
): Promise<void> {
  return file.size > SINGLE_SHOT_LIMIT
    ? uploadChunked(file, folderId, onProgress)
    : uploadSingleShot(file, folderId, onProgress);
}
