import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import type { CustomerCardOverlay } from '../types';
import { IconEmployeesBlue, IconIndustryBlue, IconLocationBlue } from '../slides/Icons';
import { resolveCustomerLogo } from '../embedded-logos';

/**
 * Customer Card overlay — draggable on canvas (like callout / text overlay).
 *
 * Fixed dimensions: 360×395 (matches the design SVG).
 * Renders as an SVG with the exact stats block clipping.
 *
 * Animation: in/out (fade, fade-up, slide-left, etc) handled at the overlay level.
 */
export const CustomerCardComp: React.FC<{
  card: CustomerCardOverlay;
  startFrame: number;
  durationFrames: number;
}> = ({ card, startFrame, durationFrames }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  // v3.28a: animations simplified to slide-right (in from right edge) and slide-right
  // (out back to right edge — same-side bounce). The editor only exposes these now.
  // Old projects with fade / fade-up / slide-left etc still work — we keep those branches
  // for back-compat so old saved decks render the way they used to.
  const animInDur = Math.max(1, Math.round((card.animInAt || 0.3) * 30));
  const animOutDur = Math.max(1, Math.round((card.animOutAt || 0.3) * 30));
  const outStart = Math.max(0, durationFrames - animOutDur);

  let opacity = 1;
  let translateY = 0;
  let translateX = 0;

  // ─── IN animations ───
  if (localFrame < animInDur) {
    if (card.animIn === 'slide-right') {
      // v3.28a default: card slides in from off-screen right (positive X) to its resting position
      opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
      translateX = interpolate(localFrame, [0, animInDur], [200, 0], {
        extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
      });
    } else if (card.animIn === 'slide-left') {
      // back-compat: slide in from left
      opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
      translateX = interpolate(localFrame, [0, animInDur], [-200, 0], {
        extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
      });
    } else if (card.animIn === 'fade') {
      opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
    } else if (card.animIn === 'fade-up') {
      opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
      translateY = interpolate(localFrame, [0, animInDur], [30, 0], {
        extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
      });
    }
  }

  // ─── OUT animations ───
  if (localFrame >= outStart) {
    if (card.animOut === 'slide-right' || card.animOut === 'slide-out-right') {
      // v3.28a default: card slides back OUT to the right edge — same side it came from
      opacity = interpolate(localFrame, [outStart, durationFrames], [1, 0], { extrapolateLeft: 'clamp' });
      translateX = interpolate(localFrame, [outStart, durationFrames], [0, 200], {
        extrapolateLeft: 'clamp', easing: Easing.in(Easing.cubic),
      });
    } else if (card.animOut === 'slide-left' || card.animOut === 'slide-out-left') {
      opacity = interpolate(localFrame, [outStart, durationFrames], [1, 0], { extrapolateLeft: 'clamp' });
      translateX = interpolate(localFrame, [outStart, durationFrames], [0, -200], {
        extrapolateLeft: 'clamp', easing: Easing.in(Easing.cubic),
      });
    } else if (card.animOut === 'fade') {
      opacity = interpolate(localFrame, [outStart, durationFrames], [1, 0], { extrapolateLeft: 'clamp' });
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: card.x,
        top: card.y,
        transform: `translate(${translateX}px, ${translateY}px)`,
        opacity,
        pointerEvents: 'none',
      }}
    >
      <CustomerCardSvg
        logoUrl={resolveCustomerLogo(card.logoUrl) || undefined}
        employees={card.employees}
        industry={card.industry}
        location={card.location}
        body={card.body}
      />
    </div>
  );
};

/**
 * Pure SVG renderer for the card — also reusable in editor preview.
 */
export const CustomerCardSvg: React.FC<{
  logoUrl?: string;
  employees: string;
  industry: string;
  location: string;
  body: string;
}> = ({ logoUrl, employees, industry, location, body }) => {
  const bodyLines = (body || '').split('\n').filter(Boolean);

  return (
    <svg
      width={360} height={400}
      viewBox="0 0 368 410"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        <clipPath id="cardClipCC">
          <rect x={3} y={3} width={354} height={393} rx={17} />
        </clipPath>
      </defs>

      {/* White card body */}
      <rect x={2} y={2} width={356} height={395} rx={18} fill="white" />

      {/* Light blue stats block (clipped inside card) */}
      <g clipPath="url(#cardClipCC)">
        <path
          d="M3 123 H304 a10 10 0 0 1 10 10 V236 a10 10 0 0 1 -10 10 H3 V123 Z"
          fill="#ECF6FF"
        />
      </g>

      {/* Blue border on top */}
      <rect x={2} y={2} width={356} height={395} rx={18} fill="none" stroke="#0183FF" strokeWidth={2} />

      {/* Customer logo area (y=20 to y=110, centered) */}
      {logoUrl ? (
        <image
          x={40} y={20} width={280} height={90}
          href={logoUrl}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <text
          x={180} y={75} textAnchor="middle"
          fill="#444444"
          fontFamily="Satoshi, system-ui, sans-serif"
          fontSize={40} fontWeight={800}
          letterSpacing={-1}
        >
          Logo
        </text>
      )}

      {/* Stats: 3 rows of icon + text inside the light blue block */}
      <foreignObject x={28} y={140} width={300} height={100}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, display: 'flex', justifyContent: 'flex-start' }}>
              <IconEmployeesBlue size={20} />
            </div>
            <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 18, fontWeight: 700, color: '#1F2431' }}>
              {employees || ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, display: 'flex', justifyContent: 'flex-start' }}>
              <IconIndustryBlue size={20} />
            </div>
            <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 18, fontWeight: 700, color: '#1F2431', lineHeight: 1.15 }}>
              {industry || ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, display: 'flex', justifyContent: 'flex-start' }}>
              <IconLocationBlue size={20} />
            </div>
            <div style={{ fontFamily: 'Satoshi, sans-serif', fontSize: 18, fontWeight: 700, color: '#1F2431' }}>
              {location || ''}
            </div>
          </div>
        </div>
      </foreignObject>

      {/* Body text (below stats block) */}
      {bodyLines.map((line, idx) => (
        <text
          key={idx}
          x={28} y={285 + idx * 21}
          fill="#1F2431"
          fontFamily="Satoshi, system-ui, sans-serif"
          fontSize={15} fontWeight={500}
        >
          {line}
        </text>
      ))}
    </svg>
  );
};
