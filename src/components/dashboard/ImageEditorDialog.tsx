"use client";

import { useMemo, useRef, useState } from "react";
import { useEffect } from "react";
import {
  Crop as CropIcon,
  Download,
  RotateCcw,
  RotateCw,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { uploadFile } from "@/lib/client-upload";
import {
  applyMagicColor,
  applyScanBW,
  defaultCorners,
  pointDistance,
  warpPerspective,
  type Point,
} from "@/lib/scan-tools";
import { CornerAdjustOverlay } from "./CornerAdjustOverlay";

const PRESETS = [
  { key: "none", label: "Original", kind: "css" },
  { key: "grayscale", label: "Grayscale", kind: "css" },
  { key: "sepia", label: "Sepia", kind: "css" },
  { key: "invert", label: "Invert", kind: "css" },
  { key: "scanBW", label: "B&W Scan", kind: "pixel" },
  { key: "magicColor", label: "Enhance", kind: "pixel" },
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];

const FORMATS = [
  { ext: "png", mime: "image/png", label: "PNG", lossy: false },
  { ext: "jpg", mime: "image/jpeg", label: "JPEG", lossy: true },
  { ext: "webp", mime: "image/webp", label: "WebP", lossy: true },
] as const;
type FormatExt = (typeof FORMATS)[number]["ext"];

type Rect = { x: number; y: number; width: number; height: number };
type Handle = "nw" | "ne" | "sw" | "se" | "move";
type Step = "crop" | "perspective" | "filters" | "adjust" | "export";

const STEPS: { key: Step; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "crop", label: "Crop", icon: CropIcon },
  { key: "perspective", label: "Perspective", icon: ScanLine },
  { key: "filters", label: "Filters", icon: Sparkles },
  { key: "adjust", label: "Adjust", icon: SlidersHorizontal },
  { key: "export", label: "Export", icon: Download },
];

const DISPLAY_MAX_DESKTOP = 480; // px — keeps the interactive canvas a manageable size regardless of source resolution

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Renders the source image rotated onto its own canvas — used as the crop
// backdrop so crop coordinates are always plain pixel coordinates in
// whatever's currently displayed, rather than needing to unwind a CSS
// `transform: rotate()` to figure out where a drag landed.
function renderRotated(img: HTMLImageElement, rotation: number): HTMLCanvasElement {
  const swap = rotation % 180 !== 0;
  const w = swap ? img.naturalHeight : img.naturalWidth;
  const h = swap ? img.naturalWidth : img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return canvas;
}

function cropCanvas(source: HTMLCanvasElement, rect: Rect): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(rect.width));
  c.height = Math.max(1, Math.round(rect.height));
  const ctx = c.getContext("2d")!;
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, c.width, c.height);
  return c;
}

function buildCssFilter(preset: PresetKey, brightness: number, contrast: number, saturation: number): string {
  const parts = [`brightness(${brightness}%)`, `contrast(${contrast}%)`, `saturate(${saturation}%)`];
  if (preset === "grayscale") parts.push("grayscale(100%)");
  if (preset === "sepia") parts.push("sepia(100%)");
  if (preset === "invert") parts.push("invert(100%)");
  return parts.join(" ");
}

function applyPixelPreset(canvas: HTMLCanvasElement, preset: PresetKey) {
  if (preset === "scanBW") applyScanBW(canvas);
  else if (preset === "magicColor") applyMagicColor(canvas);
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-[var(--glass-surface)] p-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
        <Icon className="size-3.5" aria-hidden />
        {title}
      </div>
      {children}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function ImageEditorDialog({
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
  const [step, setStep] = useState<Step>("crop");
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0);
  // Keyed by the rotation it was drawn for, rather than reset via a
  // separate effect — when rotation changes, cropState.rotation no longer
  // matches and `crop` below just falls back to the full-image default
  // computed fresh for the new rotatedCanvas. Avoids a second
  // setState-in-effect for what's really a derived-during-render value.
  const [cropState, setCropState] = useState<{ rotation: number; rect: Rect } | null>(null);
  const [perspectiveOn, setPerspectiveOn] = useState(false);
  const [cornersState, setCornersState] = useState<{ key: string; corners: [Point, Point, Point, Point] } | null>(
    null
  );
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [preset, setPreset] = useState<PresetKey>("none");
  const [format, setFormat] = useState<FormatExt>("png");
  const [quality, setQuality] = useState(85);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; startRect: Rect } | null>(null);

  // The interactive canvas is sized in raw pixels (not CSS-responsive) so
  // the crop-handle overlay's coordinates stay exact — on a narrow phone a
  // fixed 480px canvas would overflow the dialog and push controls (like
  // Save) off-screen, so this tracks actual available width instead.
  const [displayMax, setDisplayMax] = useState(DISPLAY_MAX_DESKTOP);
  useEffect(() => {
    function update() {
      // 2rem dialog inset + 2rem inner padding, allowing a little slack.
      setDisplayMax(Math.min(DISPLAY_MAX_DESKTOP, window.innerWidth - 80));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadImage(`/api/files/${fileId}/download?inline=1`).then((img) => {
      if (cancelled) return;
      setSource(img);
      setStep("crop");
      setRotation(0);
      setCropState(null);
      setPerspectiveOn(false);
      setCornersState(null);
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setPreset("none");
      setFormat("png");
      setQuality(85);
      setError(null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, fileId]);

  const rotatedCanvas = useMemo(() => (source ? renderRotated(source, rotation) : null), [source, rotation]);
  const crop = useMemo<Rect | null>(() => {
    if (cropState?.rotation === rotation) return cropState.rect;
    if (!rotatedCanvas) return null;
    return { x: 0, y: 0, width: rotatedCanvas.width, height: rotatedCanvas.height };
  }, [cropState, rotation, rotatedCanvas]);

  const croppedCanvas = useMemo(() => (rotatedCanvas && crop ? cropCanvas(rotatedCanvas, crop) : null), [
    rotatedCanvas,
    crop,
  ]);

  const cropKey = crop ? `${rotation}:${Math.round(crop.x)}:${Math.round(crop.y)}:${Math.round(crop.width)}:${Math.round(crop.height)}` : "";
  const corners = useMemo<[Point, Point, Point, Point] | null>(() => {
    if (cornersState?.key === cropKey) return cornersState.corners;
    if (!croppedCanvas) return null;
    return defaultCorners(croppedCanvas.width, croppedCanvas.height);
  }, [cornersState, cropKey, croppedCanvas]);

  // The fully composed image — crop, then perspective correction if enabled —
  // at full/native resolution. This is what filters/adjust/export/save all
  // operate on; only the crop/perspective steps show something earlier in
  // the pipeline (the pre-crop or pre-warp canvas) so the user can adjust it.
  const composedCanvas = useMemo(() => {
    if (!croppedCanvas) return null;
    if (!perspectiveOn || !corners) return croppedCanvas;
    const outW = Math.round((pointDistance(corners[0], corners[1]) + pointDistance(corners[3], corners[2])) / 2) || 1;
    const outH = Math.round((pointDistance(corners[0], corners[3]) + pointDistance(corners[1], corners[2])) / 2) || 1;
    return warpPerspective(croppedCanvas, corners, outW, outH);
  }, [croppedCanvas, perspectiveOn, corners]);

  const activeCanvas = step === "crop" ? rotatedCanvas : step === "perspective" ? croppedCanvas : composedCanvas;
  const scale = activeCanvas ? Math.min(1, displayMax / Math.max(activeCanvas.width, activeCanvas.height)) : 1;
  const displayW = activeCanvas ? Math.round(activeCanvas.width * scale) : 0;
  const displayH = activeCanvas ? Math.round(activeCanvas.height * scale) : 0;

  const activePreset = PRESETS.find((p) => p.key === preset)!;
  const filterString = buildCssFilter(preset, brightness, contrast, saturation);

  const filterThumbs = useMemo(() => {
    if (!composedCanvas) return {} as Partial<Record<PresetKey, string>>;
    const thumbMax = 96;
    const tScale = Math.min(1, thumbMax / Math.max(composedCanvas.width, composedCanvas.height));
    const tw = Math.max(1, Math.round(composedCanvas.width * tScale));
    const th = Math.max(1, Math.round(composedCanvas.height * tScale));
    const result: Partial<Record<PresetKey, string>> = {};
    for (const p of PRESETS) {
      const c = document.createElement("canvas");
      c.width = tw;
      c.height = th;
      const ctx = c.getContext("2d")!;
      ctx.filter = p.kind === "css" ? buildCssFilter(p.key, brightness, contrast, saturation) : "none";
      ctx.drawImage(composedCanvas, 0, 0, tw, th);
      applyPixelPreset(c, p.key);
      result[p.key] = c.toDataURL("image/jpeg", 0.75);
    }
    return result;
  }, [composedCanvas, brightness, contrast, saturation]);

  function onHandleDown(handle: Handle, e: React.PointerEvent) {
    if (!crop) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, startRect: crop };
  }

  function onHandleMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !rotatedCanvas) return;
    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;
    const r = drag.startRect;
    const next: Rect = { ...r };

    if (drag.handle === "move") {
      next.x = clamp(r.x + dx, 0, rotatedCanvas.width - r.width);
      next.y = clamp(r.y + dy, 0, rotatedCanvas.height - r.height);
    } else {
      const left = drag.handle === "nw" || drag.handle === "sw";
      const top = drag.handle === "nw" || drag.handle === "ne";
      if (left) {
        const newX = clamp(r.x + dx, 0, r.x + r.width - 20);
        next.width = r.width + (r.x - newX);
        next.x = newX;
      } else {
        next.width = clamp(r.width + dx, 20, rotatedCanvas.width - r.x);
      }
      if (top) {
        const newY = clamp(r.y + dy, 0, r.y + r.height - 20);
        next.height = r.height + (r.y - newY);
        next.y = newY;
      } else {
        next.height = clamp(r.height + dy, 20, rotatedCanvas.height - r.y);
      }
    }
    setCropState({ rotation, rect: next });
  }

  function onHandleUp() {
    dragRef.current = null;
  }

  const displayCorners = useMemo<[Point, Point, Point, Point] | null>(() => {
    if (!corners) return null;
    return corners.map((c) => ({ x: c.x * scale, y: c.y * scale })) as [Point, Point, Point, Point];
  }, [corners, scale]);

  function handleDisplayCornersChange(next: [Point, Point, Point, Point]) {
    setCornersState({
      key: cropKey,
      corners: next.map((c) => ({ x: c.x / scale, y: c.y / scale })) as [Point, Point, Point, Point],
    });
  }

  async function handleSave() {
    if (!composedCanvas) return;
    setSaving(true);
    setError(null);
    try {
      const out = document.createElement("canvas");
      out.width = composedCanvas.width;
      out.height = composedCanvas.height;
      const ctx = out.getContext("2d")!;
      ctx.filter = activePreset.kind === "css" ? filterString : "none";
      ctx.drawImage(composedCanvas, 0, 0);
      applyPixelPreset(out, preset);

      const formatInfo = FORMATS.find((f) => f.ext === format)!;
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, formatInfo.mime, formatInfo.lossy ? quality / 100 : undefined)
      );
      if (!blob) throw new Error("Couldn't export image.");

      const editedName = `${fileName.replace(/\.[^.]+$/, "")} (edited).${format}`;
      const file = new File([blob], editedName, { type: formatInfo.mime });
      await uploadFile(file, folderId, () => {});
      onOpenChange(false);
    } catch {
      setError("Couldn't save the edited image. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Edit ${fileName}`}
        className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-4 overflow-y-auto p-4"
      >
        {!rotatedCanvas ? (
          <p className="p-6 text-center text-sm text-ink-faint">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-1.5">
              {STEPS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStep(s.key)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    step === s.key
                      ? "border-accent text-accent"
                      : "border-border text-ink-muted hover:text-ink"
                  }`}
                >
                  <s.icon className="size-3.5" aria-hidden />
                  {s.label}
                </button>
              ))}
            </div>

            {step === "crop" && (
              <Section icon={CropIcon} title="Crop & rotate">
                <div className="mb-3 flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => setRotation((r) => (r + 270) % 360)}
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Rotate left
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                  >
                    <RotateCw className="size-3.5" aria-hidden />
                    Rotate right
                  </Button>
                </div>

                <div
                  className="relative mx-auto touch-none select-none overflow-hidden rounded-lg bg-bg-2"
                  style={{ width: displayW, height: displayH }}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                >
                  <canvas
                    ref={(el) => {
                      if (el && rotatedCanvas) {
                        el.width = displayW;
                        el.height = displayH;
                        const ctx = el.getContext("2d");
                        if (ctx) ctx.drawImage(rotatedCanvas, 0, 0, displayW, displayH);
                      }
                    }}
                    className="absolute inset-0"
                  />
                  {crop && (
                    <div
                      className="absolute cursor-move border-2 border-accent"
                      style={{
                        left: crop.x * scale,
                        top: crop.y * scale,
                        width: crop.width * scale,
                        height: crop.height * scale,
                        boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
                      }}
                      onPointerDown={(e) => onHandleDown("move", e)}
                    >
                      {(["nw", "ne", "sw", "se"] as const).map((h) => (
                        <div
                          key={h}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            onHandleDown(h, e);
                          }}
                          className="absolute size-3 rounded-full border-2 border-white bg-accent"
                          style={{
                            left: h.includes("w") ? -6 : undefined,
                            right: h.includes("e") ? -6 : undefined,
                            top: h.includes("n") ? -6 : undefined,
                            bottom: h.includes("s") ? -6 : undefined,
                            cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {step === "perspective" && croppedCanvas && (
              <Section icon={ScanLine} title="Perspective correction">
                <div className="mb-3 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setPerspectiveOn((v) => !v)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                      perspectiveOn ? "border-accent text-accent" : "border-border text-ink-muted"
                    }`}
                  >
                    {perspectiveOn ? "Perspective correction on" : "Drag corners to trace the page"}
                  </button>
                </div>
                <div
                  className="relative mx-auto touch-none select-none overflow-hidden rounded-lg bg-bg-2"
                  style={{ width: displayW, height: displayH }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local canvas-generated data URI, not a static asset */}
                  <img
                    src={croppedCanvas.toDataURL("image/png")}
                    alt=""
                    className="absolute inset-0 h-full w-full object-fill"
                    draggable={false}
                  />
                  {displayCorners && (
                    <CornerAdjustOverlay
                      displayWidth={displayW}
                      displayHeight={displayH}
                      corners={displayCorners}
                      onChange={(next) => {
                        setPerspectiveOn(true);
                        handleDisplayCornersChange(next);
                      }}
                    />
                  )}
                </div>
              </Section>
            )}

            {(step === "filters" || step === "adjust" || step === "export") && composedCanvas && (
              <div
                className="relative mx-auto overflow-hidden rounded-lg bg-bg-2"
                style={{ width: displayW, height: displayH }}
              >
                <canvas
                  ref={(el) => {
                    if (!el || !composedCanvas) return;
                    el.width = displayW;
                    el.height = displayH;
                    const ctx = el.getContext("2d");
                    if (!ctx) return;
                    ctx.filter = activePreset.kind === "css" ? filterString : "none";
                    ctx.drawImage(composedCanvas, 0, 0, displayW, displayH);
                    applyPixelPreset(el, preset);
                  }}
                  className="absolute inset-0"
                />
              </div>
            )}

            {step === "filters" && (
              <Section icon={Sparkles} title="Filters">
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPreset(p.key)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-1.5 transition-colors ${
                        preset === p.key ? "border-accent" : "border-border hover:border-border-strong"
                      }`}
                    >
                      {filterThumbs[p.key] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local canvas-generated data URI, not a static asset
                        <img src={filterThumbs[p.key]} alt="" className="aspect-square w-full rounded-lg object-cover" />
                      ) : (
                        <div className="aspect-square w-full rounded-lg bg-bg-2" />
                      )}
                      <span className={`text-[0.7rem] ${preset === p.key ? "text-accent" : "text-ink-muted"}`}>
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {step === "adjust" && (
              <Section icon={SlidersHorizontal} title="Adjust">
                {activePreset.kind === "pixel" && (
                  <p className="mb-3 text-xs text-ink-faint">
                    Brightness/contrast/saturation don&apos;t apply to the {activePreset.label} filter.
                  </p>
                )}
                <div
                  className={`grid grid-cols-3 gap-3 text-xs text-ink-muted ${
                    activePreset.kind === "pixel" ? "pointer-events-none opacity-40" : ""
                  }`}
                >
                  <label className="flex flex-col gap-1">
                    Brightness
                    <input type="range" min={50} max={150} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
                  </label>
                  <label className="flex flex-col gap-1">
                    Contrast
                    <input type="range" min={50} max={150} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
                  </label>
                  <label className="flex flex-col gap-1">
                    Saturation
                    <input type="range" min={0} max={200} value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} />
                  </label>
                </div>
              </Section>
            )}

            {step === "export" && (
              <Section icon={Download} title="Export">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-center gap-2">
                    {FORMATS.map((f) => (
                      <button
                        key={f.ext}
                        type="button"
                        onClick={() => setFormat(f.ext)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          format === f.ext ? "border-accent text-accent" : "border-border text-ink-muted"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {FORMATS.find((f) => f.ext === format)?.lossy && (
                    <label className="flex flex-col gap-1 text-xs text-ink-muted">
                      Quality ({quality}%) — lower means a smaller file
                      <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
                    </label>
                  )}
                </div>
              </Section>
            )}

            {error && <p className="text-center text-xs text-danger">{error}</p>}

            <Button type="button" variant="accent" className="w-full" disabled={saving} onClick={handleSave}>
              {saving ? "Saving…" : "Save as new file"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
