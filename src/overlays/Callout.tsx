import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { Callout as CalloutType } from '../types';

/**
 * v3.28b: Callout final design (per Patch 1 spec):
 *   - Dimensions: 367 × 100 base (min). Grows vertically with multi-line text.
 *   - Fill: linear gradient #006DD5 (left, 100%) → #0183FF (right, 100%)
 *   - Stroke: linear gradient #002B54 100% → #002B54 50% at 2px weight
 *   - Drop shadow: #002B54 @ 50% opacity, offset x=4 y=4, blur=0 (sharp)
 *   - Corner radius: 20
 *   - Text: Satoshi Bold 24px, color white, LEFT-aligned
 *   - Padding: 28px top, 32px sides, 34px bottom (gap from last text line to edge)
 *   - Animation: fade in/out only (hardcoded — editor never exposes other options)
 *
 * Implementation note: we render the gradient stroke + sharp shadow via an SVG
 * wrapper because CSS gradient borders don't compose cleanly with drop-shadow.
 */
export const CalloutComp: React.FC<{
  callout: CalloutType;
  startFrame?: number;
  durationFrames?: number;
}> = ({ callout, startFrame = 0, durationFrames = 999999 }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  // Fade in/out timing (seconds → frames). Defaults: 0.3s each.
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

  // Width: respect callout.width if set, else 367 (default v3.28b spec).
  const width = callout.width || 367;
  // Stable id for gradient defs in the SVG layer.
  const gid = `co_${callout.id || 'x'}`;

  return (
    <div style={{
      position: 'absolute',
      left: callout.x || 0,
      top: callout.y || 0,
      width,
      // Drop shadow per spec: #002B54 @ 50% opacity, x=4 y=4, blur=0.
      // CSS filter drop-shadow handles this cleanly without affecting child layout.
      filter: 'drop-shadow(4px 4px 0 rgba(0, 43, 84, 0.5))',
      opacity,
      zIndex: 50,
    }}>
      {/* SVG layer renders the gradient fill + gradient stroke + rounded rect.
          Uses preserveAspectRatio="none" so the SVG stretches vertically with the
          wrapper. For modest height growth (100→160px), rx=19 distortion is
          negligible. The text on top determines the height. */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} 100`}
        preserveAspectRatio="none"
        style={{
          position: 'absolute', inset: 0,
          display: 'block',
        }}
      >
        <defs>
          <linearGradient id={`${gid}_fill`} x1="0" y1="0.5" x2="1" y2="0.5">
            <stop offset="0%" stopColor="#006DD5" />
            <stop offset="100%" stopColor="#0183FF" />
          </linearGradient>
          <linearGradient id={`${gid}_stroke`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#002B54" stopOpacity="1" />
            <stop offset="100%" stopColor="#002B54" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <rect
          x={1} y={1}
          width={width - 2}
          height={98}
          rx={19}
          fill={`url(#${gid}_fill)`}
          stroke={`url(#${gid}_stroke)`}
          strokeWidth={2}
        />
      </svg>

      {/* Text layer on top */}
      <div style={{
        position: 'relative',
        color: '#fff',
        fontFamily: "'Satoshi', sans-serif",
        fontSize: 24,
        fontWeight: 700,
        lineHeight: 1.25,
        // 28px top, 32px sides, 34px bottom (text-to-edge gap per spec)
        padding: '28px 32px 34px 32px',
        boxSizing: 'border-box',
        wordWrap: 'break-word',
        whiteSpace: 'pre-wrap',
        textAlign: 'left',
        minHeight: 100,
      }}>
        {callout.text || 'Callout'}
      </div>
    </div>
  );
};
