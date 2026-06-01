import React from 'react';
import type { ZoomEffect, SpotlightEffect } from '../types';
import { tokens } from '../tokens';

/**
 * Zoom effect: smoothly scales the canvas around a focal point.
 *
 * v3.28b.83: REWRITTEN to match the editor preview exactly. The editor moves the
 * focal point to the CENTER of the frame (not "scale around it in place"), with
 * edge-clamping so the zoomed canvas never reveals empty space past the edges,
 * and an 800ms smoothstep ramp (capped at duration/4). The frame here IS the
 * canvas (1920x1080), so the editor's viewport math simplifies: vpW=1920,
 * vpH=1080, baseScale=1, baseTx=baseTy=0.
 *
 * Returns translate (tx,ty) + scale to apply as: translate(tx,ty) scale(scale).
 */
export function useZoomTransform(
  zooms: ZoomEffect[],
  currentFrame: number,
  fps: number,
): { scale: number; tx: number; ty: number } {
  const CW = tokens.canvasW; // 1920
  const CH = tokens.canvasH; // 1080
  const smooth = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };

  let scale = 1, tx = 0, ty = 0;

  for (const z of zooms) {
    const startMs = z.startMs;
    const durationMs = z.durationMs;
    const localMs = (currentFrame / fps) * 1000 - startMs;
    if (localMs < 0 || localMs >= durationMs) continue;

    // Editor ramp: fadeMs = min(800, duration/4), smoothstep in/out
    const fadeMs = Math.min(800, durationMs / 4);
    let p = 1;
    if (localMs < fadeMs) p = localMs / fadeMs;
    else if (localMs > durationMs - fadeMs) p = (durationMs - localMs) / fadeMs;
    p = Math.max(0, Math.min(1, p));
    const progress = smooth(p);

    const zScale = z.scale || 1.5;
    const effScale = 1 + (zScale - 1) * progress;
    const focalX = z.x;
    const focalY = z.y;

    // Editor trajectory fix: compute FINAL clamped landing once, interpolate toward it.
    const finalScale = zScale;
    const finalCanvasPxW = CW * finalScale;
    const finalCanvasPxH = CH * finalScale;
    let finalTargetTx = (CW / 2) - focalX * finalScale;
    let finalTargetTy = (CH / 2) - focalY * finalScale;
    // Clamp the TARGET so the trajectory is straight (never reveal past edges)
    if (finalCanvasPxW >= CW) {
      finalTargetTx = Math.min(0, Math.max(CW - finalCanvasPxW, finalTargetTx));
    }
    if (finalCanvasPxH >= CH) {
      finalTargetTy = Math.min(0, Math.max(CH - finalCanvasPxH, finalTargetTy));
    }

    // Interpolate baseline (0,0) -> finalTarget by progress
    let curTx = finalTargetTx * progress;
    let curTy = finalTargetTy * progress;

    // Re-clamp at current scale (matters mid-ramp when effScale < finalScale)
    const canvasPxW = CW * effScale;
    const canvasPxH = CH * effScale;
    if (canvasPxW >= CW) curTx = Math.min(0, Math.max(CW - canvasPxW, curTx));
    if (canvasPxH >= CH) curTy = Math.min(0, Math.max(CH - canvasPxH, curTy));

    scale = effScale;
    tx = curTx;
    ty = curTy;
  }

  return { scale, tx, ty };
}

/**
 * Spotlight effect: dims everything except a highlighted region.
 */
export const SpotlightComp: React.FC<{ spotlight: SpotlightEffect }> = ({ spotlight }) => {
  return (
    <>
      {/* Dim backdrop via box-shadow inset trick */}
      <div style={{
        position: 'absolute',
        left: spotlight.x,
        top: spotlight.y,
        width: spotlight.w,
        height: spotlight.h,
        borderRadius: 8,
        boxShadow: '0 0 0 4000px rgba(0,0,0,0.7)',
        zIndex: 41,
        pointerEvents: 'none' as const,
      }} />
    </>
  );
};
