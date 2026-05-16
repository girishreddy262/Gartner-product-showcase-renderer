import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { Img } from 'remotion';
import type { JourneySegment, JourneyRow } from '../types';
import { tokens } from '../tokens';
import { getPersonaById } from '../assets';
import { GlowTick, InactiveTick } from './Icons';

/**
 * Journey slide — pixel-accurate match to the design SVG.
 *
 * Canvas: 1920×1080.
 * Outer bg #002B54. Inner card x=10, y=113.5, w=1900, h=853, rx=20,
 *   filled with rgba(0,0,0,0.2) overlay.
 *
 * Layout:
 *   - Title left, top-aligned. Font 64px white bold. Starts at x=100.
 *   - 5 row Y centers: 254.917, 398.592, 543.284, 687.888, 832.58
 *     (uniform 144.7px spacing). Avatar r=41 at x=1146.16. Tick r=19.92 at x=1259.88.
 *   - Name 30px white bold, designation 18px cyan bold, description 30px white bold.
 *   - Connector segments between active rows (no extension below last row when endJourney).
 *   - Highlight up to row N: rows 1..N show glow tick; rows N+1.. show inactive tick.
 *
 * Optional footerCard (used in "with callout" variant) — note card under title.
 */

const ROW_YS = [254.917, 398.592, 543.284, 687.888, 832.58];
const AVATAR_X = 1146.16;
const TICK_X = 1259.88;
const AVATAR_R = 41;

export const JourneySlideNew: React.FC<{ seg: JourneySegment }> = ({ seg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animation modes:
  //   'none'        — all static; no zoom; no glow-in
  //   'glow-only'   — current row glow-in only; no zoom
  //   'zoom-glow'   — 30% zoom-pan into the journey area + per-row glow logic (DEFAULT)
  // Backward-compat: 'fade-glow' maps to 'zoom-glow'
  let animKind = seg.animation?.kind ?? 'zoom-glow';
  if (animKind === 'fade-glow') animKind = 'zoom-glow';
  const animOn = animKind !== 'none';
  const zoomOn = animKind === 'zoom-glow';

  // Title fade-in 0-0.5s (only when animOn)
  const titleOpacity = animOn
    ? interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 1;

  // Current-row glow-in 1.0s to 1.5s
  const glowStartFrame = 1.0 * fps;
  const glowEndFrame = 1.5 * fps;
  const glowProgress = animOn
    ? interpolate(frame, [glowStartFrame, glowEndFrame], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 1;

  // Zoom-pan: scale 1.0 → 1.3 over 0–2.0s, easy ease (inOut cubic)
  // Transform origin: TICK_X column (1259.88), vertical center of journey rows
  const zoomScale = zoomOn
    ? interpolate(frame, [0, 2.0 * fps], [1, 1.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
    : 1;

  const rows = seg.rows || [];
  const visibleRows = rows.slice(0, 5);
  const highlightUpTo = Math.max(0, Math.min(seg.highlightUpToRow || 0, visibleRows.length));

  // Build the title lines manually — split on \n. Default to single line.
  const titleLines = (seg.title || '').split('\n').filter(Boolean);
  const titleStartY = 280;
  const titleLineHeight = 90;
  const lastTitleY = titleStartY + Math.max(0, titleLines.length - 1) * titleLineHeight;
  const footerY = lastTitleY + 60; // 60px below last title line

  // Connector line segments — only between *active* rows.
  // For N rows, draw N-1 segments between consecutive ticks.
  // Optionally extend above row 0 to card edge (y=113.888) — keep this when endJourney=false
  // Optionally extend below last row to card edge (y=966.888) — DROP this when endJourney=true
  const connectorSegments: Array<{ y1: number; y2: number }> = [];
  if (visibleRows.length > 0) {
    // Above first row to card top edge
    connectorSegments.push({ y1: 113.888, y2: ROW_YS[0] - 22 });
    // Between consecutive rows
    for (let i = 0; i < visibleRows.length - 1; i++) {
      connectorSegments.push({ y1: ROW_YS[i] + 22, y2: ROW_YS[i + 1] - 22 });
    }
    // Below last row — only if NOT end journey
    if (!seg.endJourney) {
      const lastIdx = visibleRows.length - 1;
      connectorSegments.push({ y1: ROW_YS[lastIdx] + 22, y2: 966.888 });
    }
  }

  // Zoom transform: scale around (zoomCx, zoomCy) so the journey area grows centered on the ticks
  const zoomCx = TICK_X;
  const zoomCy = (ROW_YS[0] + ROW_YS[Math.min(4, Math.max(0, visibleRows.length - 1))]) / 2;
  const zoomTransform = zoomOn
    ? `translate(${zoomCx} ${zoomCy}) scale(${zoomScale}) translate(${-zoomCx} ${-zoomCy})`
    : undefined;

  return (
    <svg
      viewBox="0 0 1920 1080"
      width="100%" height="100%"
      style={{ display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer bg + inner card — DO NOT zoom these */}
      <rect width={1920} height={1080} fill={tokens.bgOuter} />
      <rect x={10} y={113.5} width={1900} height={853} rx={20} fill="black" fillOpacity={0.2} />

      {/* Zoom group — wraps the entire journey content so it scales together */}
      <g transform={zoomTransform}>
      {/* Title (left) — fades in over 0.5s */}
      {titleLines.map((line, idx) => (
        <text
          key={idx}
          x={100}
          y={titleStartY + idx * titleLineHeight}
          fill="white"
          fontFamily="Satoshi, system-ui, sans-serif"
          fontSize={64}
          fontWeight={700}
          opacity={titleOpacity}
        >
          {line}
        </text>
      ))}

      {/* Optional footer card (Model X label + body) — auto-expands with body lines */}
      {seg.footerCard && seg.footerCard.enabled && (() => {
        const bodyLines = (seg.footerCard.body || '').split('\n');
        const numLines = Math.max(1, bodyLines.length);
        // Base: 165 height for 2-line body. Add 40px per extra line beyond 2.
        // Min: 105 (for 1 line, with label). Pad: 30 top, 30 bottom for label.
        const labelHeight = seg.footerCard.label ? 60 : 20;
        const bodyHeight = numLines * 40 + 10;
        const totalH = labelHeight + bodyHeight + 30;
        return (
          <g>
            <rect x={100} y={footerY} width={403} height={totalH} rx={15} fill={tokens.blueNote} />
            {seg.footerCard.label && (
              <text
                x={130} y={footerY + 48}
                fill="rgba(255,255,255,0.65)"
                fontFamily="Satoshi, system-ui, sans-serif"
                fontSize={20} fontWeight={500}
              >
                {seg.footerCard.label}
              </text>
            )}
            {bodyLines.map((line, idx) => (
              <text
                key={idx}
                x={130} y={footerY + labelHeight + 33 + idx * 40}
                fill="white"
                fontFamily="Satoshi, system-ui, sans-serif"
                fontSize={26} fontWeight={700}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })()}

      {/* Optional RRIVE Framework logo at bottom-left (only when footerCard.showRriveLogo) */}
      {seg.footerCard?.showRriveLogo && (
        <image
          x={100} y={820}
          width={240} height={130}
          href="/rrive-framework.png"
        />
      )}

      {/* Connector line segments — drawn BEFORE the ticks so ticks sit on top */}
      {connectorSegments.map((s, i) => (
        <path key={i} d={`M${TICK_X} ${s.y1} V${s.y2}`} stroke={tokens.cyan} strokeWidth={4} />
      ))}

      {/* Rows — visible from frame 0. Per-row glow state based on highlightUpTo:
         - Past rows (i < highlightUpTo - 1): static full glow
         - Current row (i === highlightUpTo - 1): glow halo animates 1.0-1.5s
         - Future rows (i >= highlightUpTo): InactiveTick (no glow) */}
      {visibleRows.map((row, i) => {
        const isCurrentGlowRow = highlightUpTo > 0 && i === highlightUpTo - 1;
        const isPastGlowRow = highlightUpTo > 0 && i < highlightUpTo - 1;
        const isGlowRow = isCurrentGlowRow || isPastGlowRow;
        // Past rows: glow halo always full (1.0).
        // Current row: glow halo animates 0 → 1 with glowProgress.
        // Future rows: no glow.
        const rowGlowProgress = isPastGlowRow ? 1 : (isCurrentGlowRow ? glowProgress : 0);
        return (
          <g key={row.id}>
            <JourneyRowComp
              row={row}
              y={ROW_YS[i]}
              glow={isGlowRow}
              glowProgress={rowGlowProgress}
            />
          </g>
        );
      })}
      </g>
    </svg>
  );
};

const JourneyRowComp: React.FC<{
  row: JourneyRow;
  y: number;
  glow: boolean;
  glowProgress?: number;
}> = ({ row, y, glow, glowProgress = 0 }) => {
  // Resolve persona data
  const ids = row.dual ? (row.personaIds || [null, null]).slice(0, 2) : [(row.personaIds || [null])[0]];
  let nameText = row.name || '';
  let designation = row.designation || '';
  if (!row.name) {
    if (row.dual && ids.length === 2) {
      const p1 = getPersonaById(ids[0]);
      const p2 = getPersonaById(ids[1]);
      if (p1 && p2) nameText = `${p1.name} & ${p2.name}`;
    } else {
      const p = getPersonaById(ids[0]);
      if (p) nameText = p.name;
    }
  }
  if (!designation) {
    const p = getPersonaById(ids[0]);
    if (p) designation = p.designation;
  }

  // Text x position — shifts left when dual avatar to make room
  const nameTextEndX = row.dual ? AVATAR_X - 92 : AVATAR_X - 56;

  return (
    <g>
      {/* Name + designation (text-anchor end so they align to the right of the text block) */}
      {nameText && (
        <text
          x={nameTextEndX} y={y - 8}
          textAnchor="end"
          fill="white"
          fontFamily="Satoshi, system-ui, sans-serif"
          fontSize={30} fontWeight={700}
        >
          {nameText}
        </text>
      )}
      {designation && (
        <text
          x={nameTextEndX} y={y + 21}
          textAnchor="end"
          fill={tokens.cyan}
          fontFamily="Satoshi, system-ui, sans-serif"
          fontSize={18} fontWeight={700}
        >
          {designation}
        </text>
      )}

      {/* Avatar(s) — render via foreignObject to support image circles, OR plain placeholder */}
      {row.useCustomIcon && row.customIconUrl ? (
        <RowCustomIcon iconUrl={row.customIconUrl} y={y} />
      ) : row.dual ? (
        <RowDualAvatar ids={ids} y={y} />
      ) : (
        <RowSingleAvatar id={ids[0]} y={y} />
      )}

      {/* Tick mark — glow or inactive (glow animates via halo radius/opacity) */}
      {glow
        ? <GlowTick cx={TICK_X} cy={y} haloRadius={65 * Math.max(0.001, glowProgress)} />
        : <InactiveTick cx={TICK_X} cy={y} />
      }

      {/* Description text */}
      {row.description && (
        <text
          x={1320} y={y + 11}
          fill="white"
          fontFamily="Satoshi, system-ui, sans-serif"
          fontSize={30} fontWeight={700}
        >
          {row.description}
        </text>
      )}
    </g>
  );
};

// Avatar helpers — these draw circles + foreign image inside

const RowSingleAvatar: React.FC<{ id: string | null; y: number }> = ({ id, y }) => {
  const persona = getPersonaById(id);
  return (
    <g>
      {/* Clip path for circular avatar */}
      <defs>
        <clipPath id={`av-clip-${y}`}>
          <circle cx={AVATAR_X} cy={y} r={AVATAR_R} />
        </clipPath>
      </defs>
      <circle cx={AVATAR_X} cy={y} r={AVATAR_R} fill={tokens.avatarPlaceholder} />
      {persona && (
        <image
          x={AVATAR_X - AVATAR_R} y={y - AVATAR_R}
          width={AVATAR_R * 2} height={AVATAR_R * 2}
          href={persona.url}
          clipPath={`url(#av-clip-${y})`}
          preserveAspectRatio="xMidYMid slice"
        />
      )}
    </g>
  );
};

const RowDualAvatar: React.FC<{ ids: (string | null)[]; y: number }> = ({ ids, y }) => {
  // Primary at AVATAR_X, secondary at AVATAR_X - 50 (overlap ~50%)
  const secondaryX = AVATAR_X - 50;
  const persona1 = getPersonaById(ids[0]);
  const persona2 = getPersonaById(ids[1]);
  return (
    <g>
      <defs>
        <clipPath id={`av-clip-${y}-2`}>
          <circle cx={secondaryX} cy={y} r={AVATAR_R} />
        </clipPath>
        <clipPath id={`av-clip-${y}-1`}>
          <circle cx={AVATAR_X} cy={y} r={AVATAR_R} />
        </clipPath>
      </defs>
      {/* Secondary avatar (behind, to the left) */}
      <circle cx={secondaryX} cy={y} r={AVATAR_R} fill={tokens.avatarPlaceholder} stroke="#002B54" strokeWidth={3} />
      {persona2 && (
        <image
          x={secondaryX - AVATAR_R} y={y - AVATAR_R}
          width={AVATAR_R * 2} height={AVATAR_R * 2}
          href={persona2.url}
          clipPath={`url(#av-clip-${y}-2)`}
          preserveAspectRatio="xMidYMid slice"
        />
      )}
      {/* Primary avatar (front, on the right) */}
      <circle cx={AVATAR_X} cy={y} r={AVATAR_R} fill={tokens.avatarPlaceholder} stroke="#002B54" strokeWidth={3} />
      {persona1 && (
        <image
          x={AVATAR_X - AVATAR_R} y={y - AVATAR_R}
          width={AVATAR_R * 2} height={AVATAR_R * 2}
          href={persona1.url}
          clipPath={`url(#av-clip-${y}-1)`}
          preserveAspectRatio="xMidYMid slice"
        />
      )}
    </g>
  );
};

const RowCustomIcon: React.FC<{ iconUrl: string; y: number }> = ({ iconUrl, y }) => (
  <g>
    <rect x={AVATAR_X - 41} y={y - 41} width={82} height={82} rx={10} fill="rgba(255,255,255,0.08)" />
    <image
      x={AVATAR_X - 30} y={y - 30}
      width={60} height={60}
      href={iconUrl}
      preserveAspectRatio="xMidYMid meet"
    />
  </g>
);
