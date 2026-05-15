import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import type { Callout as CalloutType } from '../types';

export const CalloutComp: React.FC<{
  callout: CalloutType;
  startFrame?: number;
  durationFrames?: number;
}> = ({ callout, startFrame = 0, durationFrames = 999999 }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  // Animation handling — matches text overlay style
  const animInDur = Math.max(1, Math.round((callout.animInAt || 0) * 30));
  const animOutDur = Math.max(1, Math.round((callout.animOutAt || 0) * 30));
  const outStart = Math.max(0, durationFrames - animOutDur);

  let opacity = 1;
  let translateY = 0;
  let translateX = 0;
  let scale = 1;

  // In animations
  if (callout.animIn && animInDur > 0 && localFrame < animInDur) {
    const t = localFrame / animInDur;
    switch (callout.animIn) {
      case 'fade':
        opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
        break;
      case 'fade-up':
        opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
        translateY = interpolate(localFrame, [0, animInDur], [40, 0], {
          extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
        });
        break;
      case 'slide-left':
        opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
        translateX = interpolate(localFrame, [0, animInDur], [-60, 0], {
          extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
        });
        break;
      case 'scale':
        opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
        scale = interpolate(localFrame, [0, animInDur], [0.85, 1], {
          extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
        });
        break;
    }
  }

  // Out animations
  if (callout.animOut && animOutDur > 0 && localFrame >= outStart) {
    switch (callout.animOut) {
      case 'fade':
        opacity = interpolate(localFrame, [outStart, durationFrames], [1, 0], { extrapolateLeft: 'clamp' });
        break;
      case 'fade-out-up':
        opacity = interpolate(localFrame, [outStart, durationFrames], [1, 0], { extrapolateLeft: 'clamp' });
        translateY = interpolate(localFrame, [outStart, durationFrames], [0, -40], { extrapolateLeft: 'clamp' });
        break;
    }
  }

  return (
    <div style={{
      position: 'absolute',
      left: callout.x || 0,
      top: callout.y || 0,
      minWidth: 367,
      width: callout.width || 367,
      borderRadius: 20,
      background: 'linear-gradient(90deg, #0183FF 0%, #006DD5 100%)',
      border: '2px solid #FDDB5D',
      boxShadow: '6px 6px 0 0 rgba(0,109,213,0.4)',
      color: '#fff',
      fontFamily: "'Satoshi', sans-serif",
      fontSize: 48,
      fontWeight: 700,
      lineHeight: 1.25,
      padding: '32px 48px',
      boxSizing: 'border-box' as const,
      wordWrap: 'break-word' as const,
      textAlign: 'center' as const,
      zIndex: 50,
      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
      opacity,
    }}>
      {callout.text || 'Callout'}
    </div>
  );
};
