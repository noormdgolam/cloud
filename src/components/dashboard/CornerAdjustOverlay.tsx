"use client";

import { useRef } from "react";
import type { Point } from "@/lib/scan-tools";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Four independently-draggable corner handles over an image, connected by a
 * translucent quadrilateral outline — the "trace the page" step shared by
 * the image editor's Perspective tab and the document scanner. Corners are
 * in the same pixel space as `displayWidth`/`displayHeight` (the caller's
 * already-scaled-down preview size, not the source image's native size).
 *
 * Pointer capture is taken on each handle itself (not the container), so
 * `pointermove`/`pointerup` are attached to the same handles rather than the
 * container — capture always routes subsequent events to the element that
 * captured them, regardless of where the pointer physically is.
 */
export function CornerAdjustOverlay({
  displayWidth,
  displayHeight,
  corners,
  onChange,
}: {
  displayWidth: number;
  displayHeight: number;
  corners: [Point, Point, Point, Point];
  onChange: (corners: [Point, Point, Point, Point]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  function handlePointerDown(index: number, e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragIndexRef.current = index;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const index = dragIndexRef.current;
    if (index === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, displayWidth);
    const y = clamp(e.clientY - rect.top, 0, displayHeight);
    const next = [...corners] as [Point, Point, Point, Point];
    next[index] = { x, y };
    onChange(next);
  }

  function handlePointerUp() {
    dragIndexRef.current = null;
  }

  const pointsAttr = corners.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0"
      style={{ width: displayWidth, height: displayHeight }}
    >
      <svg className="absolute inset-0" width={displayWidth} height={displayHeight}>
        <polygon points={pointsAttr} fill="rgba(124,92,255,0.18)" stroke="var(--accent)" strokeWidth={2} />
      </svg>
      {corners.map((c, i) => (
        <div
          key={i}
          onPointerDown={(e) => handlePointerDown(i, e)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="pointer-events-auto absolute size-5 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-accent shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
          style={{ left: c.x, top: c.y }}
        />
      ))}
    </div>
  );
}
