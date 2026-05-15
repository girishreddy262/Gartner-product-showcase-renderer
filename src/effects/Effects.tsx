import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import type { ZoomEffect, SpotlightEffect } from '../types';
import { tokens } from '../tokens';

/**
 * Zoom effect: smoothly scales the canvas around a focal point.
 * In Remotion, this is applied as a transform on the parent container.
 * This component returns the transform values to be applied by the parent.
 */
export function useZoomTransform(
  zooms: ZoomEffect[],
  currentFrame: number,
  fps: number,
): { scale: number; originX: number; originY: number } {
  let scale = 1;
  let originX = tokens.canvasW / 2;
  let originY = tokens.canvasH / 2;

  for (const z of zooms) {
    const startFrame = Math.round(z.startMs / 1000 * fps);
    const endFrame = Math.round((z.startMs + z.durationMs) / 1000 * fps);
    const rampFrames = Math.round(fps * 0.6); // 0.6s ease in/out — slower, smoother

    if (currentFrame >= startFrame && currentFrame < endFrame) {
      let zoomProgress: number;

      if (currentFrame < startFrame + rampFrames) {
        // Ease in with cubic curve
        zoomProgress = interpolate(
          currentFrame,
          [startFrame, startFrame + rampFrames],
          [0, 1],
          { extrapolateRight: 'clamp', easing: Easing.bezier(0.42, 0, 0.58, 1) }
        );
      } else if (currentFrame > endFrame - rampFrames) {
        // Ease out with cubic curve
        zoomProgress = interpolate(
          currentFrame,
          [endFrame - rampFrames, endFrame],
          [1, 0],
          { extrapolateRight: 'clamp', easing: Easing.bezier(0.42, 0, 0.58, 1) }
        );
      } else {
        zoomProgress = 1;
      }

      scale = interpolate(zoomProgress, [0, 1], [1, z.scale || 1.5]);
      originX = z.x;
      originY = z.y;
    }
  }

  return { scale, originX, originY };
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
