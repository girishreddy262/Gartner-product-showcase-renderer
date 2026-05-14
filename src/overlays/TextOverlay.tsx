import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { TextOverlay as TextOverlayType } from '../types';

const ANIM_DURATION_FRAMES = 15; // 0.5s at 30fps

function getAnimTransform(
  animType: string,
  progress: number, // 0 = hidden, 1 = fully visible
): { opacity: number; transform: string } {
  switch (animType) {
    case 'fade':
      return { opacity: progress, transform: 'none' };
    case 'slideLeft':
      return { opacity: progress, transform: `translateX(${(1 - progress) * -120}px)` };
    case 'slideRight':
      return { opacity: progress, transform: `translateX(${(1 - progress) * 120}px)` };
    case 'slideUp':
      return { opacity: progress, transform: `translateY(${(1 - progress) * -80}px)` };
    case 'slideDown':
      return { opacity: progress, transform: `translateY(${(1 - progress) * 80}px)` };
    default:
      return { opacity: 1, transform: 'none' };
  }
}

export const TextOverlayComp: React.FC<{
  overlay: TextOverlayType;
  startFrame: number;
  durationFrames: number;
}> = ({ overlay, startFrame, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame; // Already relative to Sequence start

  let opacity = 1;
  let transform = 'none';

  // Animate in
  if (overlay.animIn && overlay.animIn !== 'none') {
    const inAtFrame = Math.round((overlay.animInAt || 0) * fps);
    if (localFrame < inAtFrame) {
      opacity = 0;
    } else if (localFrame < inAtFrame + ANIM_DURATION_FRAMES) {
      const progress = interpolate(
        localFrame,
        [inAtFrame, inAtFrame + ANIM_DURATION_FRAMES],
        [0, 1],
        { extrapolateRight: 'clamp' }
      );
      const result = getAnimTransform(overlay.animIn, progress);
      opacity = result.opacity;
      transform = result.transform;
    }
  }

  // Animate out (overrides if both active, but typically they don't overlap)
  if (overlay.animOut && overlay.animOut !== 'none') {
    const outAtFrame = Math.round((overlay.animOutAt || (overlay.durationMs / 1000 - 0.5)) * fps);
    if (localFrame >= outAtFrame + ANIM_DURATION_FRAMES) {
      opacity = 0;
    } else if (localFrame >= outAtFrame) {
      const progress = interpolate(
        localFrame,
        [outAtFrame, outAtFrame + ANIM_DURATION_FRAMES],
        [1, 0],
        { extrapolateRight: 'clamp' }
      );
      const result = getAnimTransform(overlay.animOut, progress);
      opacity = result.opacity;
      transform = result.transform;
    }
  }

  return (
    <div style={{
      position: 'absolute',
      left: overlay.x || 0,
      top: overlay.y || 0,
      fontSize: overlay.fontSize || 48,
      fontWeight: overlay.fontWeight || 700,
      fontStyle: overlay.italic ? 'italic' : 'normal',
      color: overlay.color || '#FFFFFF',
      fontFamily: "'Satoshi', sans-serif",
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      opacity,
      transform,
    }}>
      {overlay.text || 'Text'}
    </div>
  );
};
