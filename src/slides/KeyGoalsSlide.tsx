import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { KeyGoalsSegment } from '../types';
import { tokens } from '../tokens';
import { IconHeadcountWhite, IconIndustryWhite, IconCountriesWhite, IconKeyGoal } from './Icons';
import { resolveCustomerLogo } from '../embedded-logos';

/**
 * Key Goals slide.
 * Canvas 1920×1080. Bg #002B54 + inner card overlay.
 *
 * Left side: customer logo card (x=100, y=180, w=728, h=311, rx=14) with 30% opacity navy bg
 *   - Logo area (upper) for uploaded customer logo
 *   - Divider line at y=370
 *   - 3 stats row (icon + text) below — text at y=465
 *   - World map below the card (y=624, h=186)
 *
 * Right side: "Key Goals" title (72px) at x=1080, y=320
 *   - 2-6 goals stacked vertically with target icons (62×62 at x=1085)
 *   - Dashed connector between targets
 *   - Goal text 28px to the right
 */
export const KeyGoalsSlide: React.FC<{ seg: KeyGoalsSegment }> = ({ seg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const goals = (seg.bullets || []).slice(0, 6);
  const stats = (seg.customerStats || []).slice(0, 3);

  // Animation opt-in. Default 'fade-stagger' = customer card fades in, then goals stagger top→bottom.
  const animKind = seg.animation?.kind ?? 'fade-stagger';
  const animOn = animKind !== 'none';

  // Animation: customer card fades in at 0-0.5s, goals stagger in starting 0.4s
  const cardOpacity = animOn
    ? interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 1;
  const cardTx = animOn
    ? interpolate(frame, [0, 0.5 * fps], [-20, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 0;
  const titleOpacity = animOn
    ? interpolate(frame, [0.2 * fps, 0.7 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 1;

  // Goals are spaced 134px apart, starting at y=395
  const goalYs = goals.map((_, i) => 395 + i * 134);

  return (
    <svg
      viewBox="0 0 1920 1080"
      width="100%" height="100%"
      style={{ display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={1920} height={1080} fill={tokens.bgOuter} />
      <rect x={10} y={113.5} width={1900} height={853} rx={20} fill="black" fillOpacity={0.2} />

      {/* Customer logo card — fades in from left */}
      <g opacity={cardOpacity} transform={`translate(${cardTx}, 0)`}>
        <rect x={100} y={180} width={728} height={311} rx={14} fill="#1B4369" fillOpacity={0.3} />

        {/* Customer logo (centered in upper area) */}
        {seg.customerLogoUrl && (
          <image
            x={314} y={210} width={300} height={150}
            href={resolveCustomerLogo(seg.customerLogoUrl) || ''}
            preserveAspectRatio="xMidYMid meet"
          />
        )}

        {/* Divider line */}
        <line x1={180} y1={370} x2={748} y2={370} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />

        {/* Customer stats (3 icons + text) */}
        {stats.map((stat, i) => {
          const x = 244 + i * 218; // centers at 244, 462, 680
          return (
            <g key={stat.id} transform={`translate(${x - 24}, 395)`}>
              <foreignObject x={0} y={0} width={48} height={36}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <StatIcon kind={stat.iconKind} customUrl={stat.customIconUrl} />
                </div>
              </foreignObject>
              <text
                x={24} y={70}
                textAnchor="middle"
                fill="white"
                fontFamily="Satoshi, system-ui, sans-serif"
                fontSize={18} fontWeight={700}
              >
                {stat.text || ''}
              </text>
            </g>
          );
        })}

        {/* World map placeholder */}
        <rect x={148} y={624} width={668} height={186} fill="#0A2E54" />
      </g>

      {/* "Key Goals" title (right side) — fades in */}
      <text
        x={1080} y={320}
        fill="white"
        fontFamily="Satoshi, system-ui, sans-serif"
        fontSize={72} fontWeight={700}
        opacity={titleOpacity}
      >
        Key Goals
      </text>

      {/* Dashed connector lines between goals — staggered with goals */}
      {goalYs.slice(0, -1).map((y, i) => {
        const start = (0.5 + (i + 1) * 0.12) * fps;
        const end = start + 0.3 * fps;
        const op = interpolate(frame, [start, end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <line
            key={i}
            x1={1116} y1={y + 35}
            x2={1116} y2={goalYs[i + 1] - 1}
            stroke="#7ABEFF"
            strokeWidth={2}
            strokeDasharray="9 9"
            opacity={op}
          />
        );
      })}

      {/* Goal targets — stagger fade-in */}
      {goals.map((goal, i) => {
        const y = goalYs[i];
        const lines = (goal.text || '').split('\n');
        const goalStart = (0.4 + i * 0.12) * fps;
        const goalEnd = goalStart + 0.4 * fps;
        const opacity = animOn
          ? interpolate(frame, [goalStart, goalEnd], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          : 1;
        const tx = animOn
          ? interpolate(frame, [goalStart, goalEnd], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          : 0;
        return (
          <g key={goal.id} opacity={opacity} transform={`translate(${tx}, 0)`}>
            <foreignObject x={1085} y={y - 31} width={62} height={62}>
              <div style={{ width: 62, height: 62 }}>
                <IconKeyGoal size={62} />
              </div>
            </foreignObject>
            {lines.map((line, idx) => (
              <text
                key={idx}
                x={1180} y={y - 5 + idx * 34}
                fill="white"
                fontFamily="Satoshi, system-ui, sans-serif"
                fontSize={28} fontWeight={700}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
};

const StatIcon: React.FC<{ kind: string; customUrl?: string | null }> = ({ kind, customUrl }) => {
  if (kind === 'custom' && customUrl) {
    return <img src={customUrl} alt="" style={{ height: 32, width: 'auto' }} />;
  }
  switch (kind) {
    case 'headcount': return <IconHeadcountWhite size={32} />;
    case 'industry': return <IconIndustryWhite size={32} />;
    case 'countries': return <IconCountriesWhite size={34} />;
    default: return <IconHeadcountWhite size={32} />;
  }
};
