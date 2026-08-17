"use client";

// Re-encoding an image through canvas strips EXIF/metadata (GPS location,
// camera model, timestamps) as a side effect — canvas only ever holds raw
// pixel data, so drawImage()+toBlob() has nothing to carry the metadata
// forward with. No dedicated EXIF-parsing library needed.
export async function stripImageMetadata(sourceUrl: string, mimeType: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = sourceUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  // Re-export as the same format where canvas supports it; PNG/GIF/others
  // fall back to PNG (canvas can only ever export a fixed set of formats).
  const exportMime = mimeType === "image/jpeg" || mimeType === "image/webp" ? mimeType : "image/png";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, exportMime));
  if (!blob) throw new Error("Couldn't process image.");
  return blob;
}
