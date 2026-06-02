import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { KeyGoalsSegment } from '../types';
import { tokens } from '../tokens';
import { IconHeadcountWhite, IconIndustryWhite, IconCountriesWhite, IconKeyGoal } from './Icons';
import { ACME_LOGO_DATA_URL } from '../embedded-logos';
import { KEY_GOALS_MAP_URL } from '../key-goals-assets';

/**
 * Key Goals slide (v3.28b.2 + v3.28b.XX).
 * Canvas 1920×1080. Bg #002B54 + inner card overlay.
 *
 * v3.28b.XX: split into two variations driven by seg.variation field:
 *   variation 1 (default, original): customer card + stats + small map left,
 *                                    "Key Goals" title + goals list right
 *   variation 2 (map-hero):          slim left card (logo + 3 vertical stats),
 *                                    big world map right, no goals list
 *
 * The dispatcher at the bottom of this file routes on seg.variation; both V1
 * and V2 are exported separately so each is easy to reason about in isolation.
 */
export const KeyGoalsSlide: React.FC<{ seg: KeyGoalsSegment }> = ({ seg }) => {
  const v = seg.variation || 1;
  if (v === 2) return <KeyGoalsSlideV2 seg={seg} />;
  return <KeyGoalsSlideV1 seg={seg} />;
};

/**
 * Key Goals V1 (original layout, unchanged from v3.28b.2).
 *
 * Left side: customer logo card (x=100, y=180, w=728, h=311, rx=14)
 *   - Logo area: bundled ACME (locked)
 *   - Divider line at y=370
 *   - 3 stats row (icon + text) below — text at y=465
 *   - World map below the card (locked to bundled SVG)
 *
 * Right side: "Key Goals" title (72px) at x=1080, y=280
 *   - 2-6 goals stacked vertically with target icons
 */
const KeyGoalsSlideV1: React.FC<{ seg: KeyGoalsSegment }> = ({ seg }) => {
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

        {/* Customer logo — LOCKED to bundled ACME (v3.28b.2) */}
        <image
          x={314} y={210} width={300} height={150}
          href={ACME_LOGO_DATA_URL}
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Divider line */}
        <line x1={180} y1={370} x2={748} y2={370} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />

        {/* Customer stats (3 icons + text) — stagger 200ms apart */}
        {stats.map((stat, i) => {
          const x = 244 + i * 218; // centers at 244, 462, 680
          const statStart = (0.5 + i * 0.2) * fps;
          const statEnd = statStart + 0.35 * fps;
          const statOpacity = animOn
            ? interpolate(frame, [statStart, statEnd], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
            : 1;
          const statTy = animOn
            ? interpolate(frame, [statStart, statEnd], [12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
            : 0;
          return (
            <g key={stat.id} transform={`translate(${x - 24}, ${395 + statTy})`} opacity={statOpacity}>
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

        {/* World map — LOCKED to bundled Darwinbox office-pins SVG (v3.28b.2) */}
        <image
          x={148} y={544} width={668} height={320}
          href={KEY_GOALS_MAP_URL}
          preserveAspectRatio="xMidYMid meet"
          opacity={0.95}
        />
      </g>

      {/* "Key Goals" title — v3.28b.2: moved up from y=320 to y=280 */}
      <text
        x={1080} y={280}
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

/**
 * Key Goals V2 — map-hero layout (v3.28b.XX).
 *
 * Layout (from Key_goals_new__1.svg, 1920×1080):
 *   - Bg #002B54 + same inner card overlay as V1 (10/113.5, 1900x853, rx20, black 20%)
 *   - Slim left card: x=170, y=97, w=440, h=747, rx=15, fill #032444
 *       - Customer logo: top of card, ~190/175, 300×120 area (cover/contain)
 *       - Divider at y=~340 across the card width
 *       - 3 vertical stats below: icon on top, text below — spaced ~150px apart
 *   - Big world map: right side, full height, x≈640, y≈130, scaled to ~1180×740
 *
 * Editable: customer stats text (and icons), customer logo. Map and chrome locked.
 * Animations: each stat fades in + small upward translate, staggered (200ms apart).
 *             Map fades in at 0.4-1.0s. No goals list (V2 has no goals).
 */
const KeyGoalsSlideV2: React.FC<{ seg: KeyGoalsSegment }> = ({ seg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stats = (seg.customerStats || []).slice(0, 3);

  const animKind = seg.animation?.kind ?? 'fade-stagger';
  const animOn = animKind !== 'none';

  // Card fades in from left at 0-0.5s
  const cardOpacity = animOn
    ? interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 1;
  const cardTx = animOn
    ? interpolate(frame, [0, 0.5 * fps], [-30, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 0;

  // Map fades in at 0.4-1.0s
  const mapOpacity = animOn
    ? interpolate(frame, [0.4 * fps, 1.0 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 1;

  // Stats layout: 3 stacked vertically inside the slim left card.
  // Card is x=170, y=97, w=440, h=747. Logo takes top ~250px, divider at y=347.
  // Stats area: y=420..780. Three stats: ~y=470, y=600, y=730 (130px apart).
  const cardX = 170;
  const cardY = 97;
  const cardW = 440;
  const cardCenterX = cardX + cardW / 2; // 390
  const statYs = [470, 600, 730];

  return (
    <svg
      viewBox="0 0 1920 1080"
      width="100%" height="100%"
      style={{ display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer bg + inner card chrome — same as V1 */}
      <rect width={1920} height={1080} fill={tokens.bgOuter} />
      <rect x={10} y={113.5} width={1900} height={853} rx={20} fill="black" fillOpacity={0.2} />

      {/* Slim left card */}
      <g opacity={cardOpacity} transform={`translate(${cardTx}, 0)`}>
        <rect x={cardX} y={cardY} width={cardW} height={747} rx={15} fill="#032444" />

        {/* Customer logo — LOCKED to bundled ACME (matches V1 behavior).
            Centered horizontally, top of the card. */}
        <image
          x={cardCenterX - 150} y={175} width={300} height={150}
          href={ACME_LOGO_DATA_URL}
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Divider across card */}
        <line
          x1={cardX + 40} y1={355}
          x2={cardX + cardW - 40} y2={355}
          stroke="rgba(255,255,255,0.2)" strokeWidth={1}
        />

        {/* 3 vertical stats — each fades in + small upward translate, staggered */}
        {statYs.map((sy, i) => {
          const stat = stats[i];
          if (!stat) return null;
          const statStart = (0.5 + i * 0.2) * fps;
          const statEnd = statStart + 0.4 * fps;
          const opacity = animOn
            ? interpolate(frame, [statStart, statEnd], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
            : 1;
          const ty = animOn
            ? interpolate(frame, [statStart, statEnd], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
            : 0;
          return (
            <g key={stat.id || i} opacity={opacity} transform={`translate(0, ${ty})`}>
              {/* Icon centered above text */}
              <foreignObject x={cardCenterX - 24} y={sy - 36} width={48} height={48}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 48, height: 48 }}>
                  <StatIcon kind={stat.iconKind} customUrl={stat.customIconUrl} />
                </div>
              </foreignObject>
              {/* Text centered below icon */}
              <text
                x={cardCenterX} y={sy + 36}
                textAnchor="middle"
                fill="white"
                fontFamily="Satoshi, system-ui, sans-serif"
                fontSize={22} fontWeight={700}
              >
                {stat.text || ''}
              </text>
            </g>
          );
        })}
      </g>

      {/* Big world map — locked, right side, fades in.
          Source asset is 818×408 (≈ 2:1). Map area: x=660..1860, y=130..870 (1200×740). */}
      <image
        x={660} y={130}
        width={1200} height={740}
        href={KEY_GOALS_MAP_URL}
        preserveAspectRatio="xMidYMid meet"
        opacity={mapOpacity}
      />
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
