"use client";

export async function optimizeSvg(sourceUrl: string): Promise<Blob> {
  const res = await fetch(sourceUrl);
  const text = await res.text();

  const { optimize } = await import("svgo/browser");
  const result = optimize(text, { multipass: true });
  return new Blob([result.data], { type: "image/svg+xml" });
}
