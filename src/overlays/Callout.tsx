import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { Callout as CalloutType } from '../types';

// v3.28a: Callout simplified to fade-in / fade-out only. All other animations removed.
// Old projects with animIn='slide-left' etc continue to load — we just always render
// the fade behavior regardless of what's stored. Editor UI no longer exposes the choice.
// Size reduced by ~20% (367x110 → 294x88 approx) with text shrunk smartly.
export const CalloutComp: React.FC<{
  callout: CalloutType;
  startFrame?: number;
  durationFrames?: number;
}> = ({ callout, startFrame = 0, durationFrames = 999999 }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  // Fade timing from animInAt / animOutAt (seconds). Defaults: 0.3s.
  const animInDur = Math.max(1, Math.round((callout.animInAt ?? 0.3) * 30));
  const animOutDur = Math.max(1, Math.round((callout.animOutAt ?? 0.3) * 30));
  const outStart = Math.max(0, durationFrames - animOutDur);

  let opacity = 1;
  if (localFrame < animInDur) {
    opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
  }
  if (localFrame >= outStart) {
    opacity = interpolate(localFrame, [outStart, durationFrames], [1, 0], { extrapolateLeft: 'clamp' });
  }

  return (
    <div style={{
      position: 'absolute',
      left: callout.x || 0,
      top: callout.y || 0,
      // v3.28a: ~20% smaller — was 367 wide, now 294.
      minWidth: 294,
      width: callout.width || 294,
      borderRadius: 16,
      background: 'linear-gradient(90deg, #0183FF 0%, #006DD5 100%)',
      border: '2px solid #FDDB5D',
      boxShadow: '5px 5px 0 0 rgba(0,109,213,0.4)',
      color: '#fff',
      fontFamily: "'Satoshi', sans-serif",
      // v3.28a: smart text shrink — readable, not proportionally tiny. 48 → 38.
      fontSize: 38,
      fontWeight: 700,
      lineHeight: 1.25,
      padding: '26px 38px',
      boxSizing: 'border-box' as const,
      wordWrap: 'break-word' as const,
      whiteSpace: 'pre-wrap' as const,
      textAlign: 'center' as const,
      zIndex: 50,
      opacity,
    }}>
      {callout.text || 'Callout'}
    </div>
  );
};
