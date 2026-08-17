"use client";

// Mirrors client-upload.ts's uploadFile — same XHR-with-progress shape —
// but POSTs to the replace route for an existing file instead of creating a
// new one. No chunked variant: editor-produced files (docx/xlsx/pdf) are
// realistically always well under the 100MB single-shot ceiling.
export function replaceFileContent(
  fileId: string,
  bytes: BlobPart,
  mimeType: string,
  filename: string,
  onProgress: (pct: number) => void = () => {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/files/${fileId}/replace`);

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

    xhr.addEventListener("error", () => reject(new Error("Network error while saving.")));

    const file = new File([bytes], filename, { type: mimeType });
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

function parseXhrError(xhr: XMLHttpRequest): string {
  try {
    const body = JSON.parse(xhr.responseText);
    return body.error ?? `Save failed (${xhr.status}).`;
  } catch {
    return `Save failed (${xhr.status}).`;
  }
}
