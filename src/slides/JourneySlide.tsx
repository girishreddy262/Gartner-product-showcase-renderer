import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { Img } from 'remotion';
import type { JourneySegment, JourneyRow } from '../types';
import { tokens } from '../tokens';
import { getPersonaById } from '../assets';
import { GlowTick, InactiveTick } from './Icons';

/**
 * Journey slide — pixel-accurate match to the design SVG, WITH camera animation.
 *
 * Canvas: 1920×1080.
 *
 * v3.28b.81: Re-inlined the camera (zoom + pan) animation that was lost in an
 * earlier commit, causing rendered MP4s to be static. The camera math is a
 * 1:1 port of the editor preview (renderJourneySVG in editor.html), so the MP4
 * matches the timeline preview frame-for-frame.
 *
 * Timeline (t = ms from slide start):
 *   0–1000ms (PRE_ROLL): full slide visible, no zoom (scale 1).
 *   1000ms: first active row glow fires; zoom ramp begins.
 *   1000–1700ms (ZOOM_RAMP 700ms): scale 1 → 1.5, focal centers on active row,
 *     header (title/footer/logo) fades out.
 *   every 1400ms (ROW_HOLD): next row activates (glow + camera pans down 700ms).
 *   last 600ms (FADE_OUT): whole slide fades opacity → 0.
 *   startZoomedIn flag: zoom = 1 from frame 0, rows fire immediately.
 */

const ROW_YS = [254.917, 398.592, 543.284, 687.888, 832.58];
const AVATAR_X = 1146.16;
const TICK_X = 1259.88;
const AVATAR_R = 41;

// Camera constants (mirror editor.html renderJourneySVG)
const CW = 1920, CH = 1080;
const ZOOM_SCALE = 1.5;
const FOCAL_X = 1260;
const ZOOM_RAMP_MS = 700;
const PAN_MS = 700;
const FADE_OUT_MS = 600;
const GLOW_IN_MS = 500;
const ROW_HOLD_MS = 1400;
const PRE_ROLL_MS = 1000;

const smooth = (tt: number) => { const c = Math.max(0, Math.min(1, tt)); return c * c * (3 - 2 * c); };

export const JourneySlideNew: React.FC<{ seg: JourneySegment; headerOpacity?: number }> = ({ seg, headerOpacity: headerOpacityProp }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Time within this slide, in ms. The slide's own Sequence makes frame 0 = slide start.
  const t = (frame / fps) * 1000;
  // Slide duration in ms (from the Sequence length).
  const segDurationMs = (durationInFrames / fps) * 1000;

  const rows = seg.rows || [];
  const visibleRows = rows.slice(0, 5);
  const Nrows = visibleRows.length;

  // v3.28b.40: optional flag — start already zoomed in.
  const startZoomedIn = !!(seg.journeyZoom && (seg.journeyZoom as { startZoomedIn?: boolean }).startZoomedIn);

  // Resolve glow state per row (back-compat with seg.highlightUpToRow)
  const N = Math.max(0, Math.min(seg.highlightUpToRow || 0, Nrows));
  const resolvedGlow: string[] = visibleRows.map((row, i) => {
    if (row.glowState) return row.glowState as string;
    if (N === 0) return 'inactive';
    if (i < N - 1) return 'glow-static';
    if (i === N - 1) return 'glow-animate';
    return 'inactive';
  });

  // ---- Per-row glow progress (animate ordinal, fires at PRE_ROLL + ord*ROW_HOLD) ----
  let _animOrd = 0;
  const rowProgress: number[] = visibleRows.map((row, i) => {
    const st = resolvedGlow[i];
    if (st === 'inactive') return 0;
    if (st === 'glow-static') return 1;
    // glow-animate
    const preRoll = startZoomedIn ? 0 : PRE_ROLL_MS;
    const activeAt = preRoll + _animOrd * ROW_HOLD_MS;
    _animOrd++;
    if (t < activeAt) return 0;
    if (t > activeAt + GLOW_IN_MS) return 1;
    return smooth((t - activeAt) / GLOW_IN_MS);
  });

  // ---- Camera transform (zoom + pan) ----
  let scale = 1, txCam = 0, tyCam = 0;
  let headerOpacity = 1, slideOpacity = 1;

  // zoom progress
  let zoomProgress = 0;
  if (startZoomedIn) {
    zoomProgress = 1;
  } else if (t < PRE_ROLL_MS) {
    zoomProgress = 0;
  } else if (t < PRE_ROLL_MS + ZOOM_RAMP_MS) {
    zoomProgress = smooth((t - PRE_ROLL_MS) / ZOOM_RAMP_MS);
  } else {
    zoomProgress = 1;
  }
  headerOpacity = 1 - zoomProgress;
  // fade out last 600ms
  if (t > segDurationMs - FADE_OUT_MS) {
    slideOpacity = Math.max(0, (segDurationMs - t) / FADE_OUT_MS);
  }

  // focal row index over time
  const minCp = Nrows >= 3 ? 1 : 0;
  const maxCp = Nrows >= 3 ? Nrows - 2 : Math.max(0, Nrows - 1);
  const cpAt = (time: number) => {
    let last = 0;
    let ordinal = 0;
    for (let i = 0; i < Nrows; i++) {
      const st = resolvedGlow[i];
      if (st === 'inactive') continue;
      if (st === 'glow-static') { last = Math.max(last, i); continue; }
      const activeAt = (startZoomedIn ? 0 : PRE_ROLL_MS) + ordinal * ROW_HOLD_MS;
      ordinal++;
      if (time >= activeAt) last = Math.max(last, i);
    }
    return Math.max(minCp, Math.min(maxCp, last));
  };

  let focalY = ROW_YS[cpAt(0)] ?? ROW_YS[0];
  let prevCp = cpAt(0);
  let ord = 0;
  for (let i = 0; i < Nrows; i++) {
    const st = resolvedGlow[i];
    if (st !== 'glow-animate') continue;
    const tCp = (startZoomedIn ? 0 : PRE_ROLL_MS) + ord * ROW_HOLD_MS;
    ord++;
    const newCp = cpAt(tCp);
    if (newCp !== prevCp) {
      const targetY = ROW_YS[newCp];
      if (t >= tCp + PAN_MS) {
        focalY = targetY;
      } else if (t >= tCp) {
        focalY = focalY + (targetY - focalY) * smooth((t - tCp) / PAN_MS);
        break;
      } else {
        break;
      }
      prevCp = newCp;
    }
  }

  scale = 1 + (ZOOM_SCALE - 1) * zoomProgress;
  const screenFx = (1 - zoomProgress) * FOCAL_X + zoomProgress * (CW / 2);
  const screenFy = (1 - zoomProgress) * focalY + zoomProgress * (CH / 2);
  txCam = screenFx - FOCAL_X * scale;
  tyCam = screenFy - focalY * scale;

  // If Root passes an explicit headerOpacity (legacy zoom-effect fade), respect the
  // lower of the two so an external zoom effect can still hide the header.
  if (typeof headerOpacityProp === 'number') {
    headerOpacity = Math.min(headerOpacity, headerOpacityProp);
  }
  const showHeader = headerOpacity > 0.01;

  // Title lines
  const titleLines = (seg.title || '').split('\n').filter(Boolean);
  const titleStartY = 280;
  const titleLineHeight = 90;
  const lastTitleY = titleStartY + Math.max(0, titleLines.length - 1) * titleLineHeight;
  const footerY = lastTitleY + 60;

  // Connector segments
  const connectorSegments: Array<{ y1: number; y2: number }> = [];
  if (visibleRows.length > 0) {
    connectorSegments.push({ y1: 113.888, y2: ROW_YS[0] - 22 });
    for (let i = 0; i < visibleRows.length - 1; i++) {
      connectorSegments.push({ y1: ROW_YS[i] + 22, y2: ROW_YS[i + 1] - 22 });
    }
    if (!seg.endJourney) {
      const lastIdx = visibleRows.length - 1;
      connectorSegments.push({ y1: ROW_YS[lastIdx] + 22, y2: 966.888 });
    }
  }

  const clipId = `card-clip-${seg.id}`;

  return (
    <svg
      viewBox="0 0 1920 1080"
      width="100%" height="100%"
      style={{ display: 'block', opacity: slideOpacity }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={10} y={113.5} width={1900} height={853} rx={20} />
        </clipPath>
      </defs>

      {/* Static frame — outer navy + inner card. Does NOT zoom/pan. */}
      <rect width={1920} height={1080} fill={tokens.bgOuter} />
      <rect x={10} y={113.5} width={1900} height={853} rx={20} fill="black" fillOpacity={0.2} />

      {/* Clipped content layer with internal camera transform */}
      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(${txCam.toFixed(2)} ${tyCam.toFixed(2)}) scale(${scale.toFixed(4)})`}>

          {/* Header group (title + footer card + RRIVE logo) — fades with zoom */}
          {showHeader && (
            <g opacity={headerOpacity}>
              {titleLines.map((line, idx) => (
                <text
                  key={idx}
                  x={100}
                  y={titleStartY + idx * titleLineHeight}
                  fill="white"
                  fontFamily="Satoshi, system-ui, sans-serif"
                  fontSize={64}
                  fontWeight={700}
                >
                  {line}
                </text>
              ))}

              {seg.footerCard && seg.footerCard.enabled && (() => {
                const bodyLines = (seg.footerCard.body || '').split('\n');
                const numLines = Math.max(1, bodyLines.length);
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

              {seg.footerCard?.showRriveLogo && (
                <image
                  x={100} y={820}
                  width={240} height={130}
                  href="/rrive-framework.png"
                />
              )}
            </g>
          )}

          {/* Connector line segments — drawn BEFORE ticks so ticks sit on top */}
          {connectorSegments.map((s, i) => (
            <path key={i} d={`M${TICK_X} ${s.y1} V${s.y2}`} stroke={tokens.cyan} strokeWidth={4} />
          ))}

          {/* Rows */}
          {visibleRows.map((row, i) => {
            const st = resolvedGlow[i];
            const isGlowRow = st !== 'inactive';
            const p = rowProgress[i];
            return (
              <g key={row.id}>
                <JourneyRowComp
                  row={row}
                  y={ROW_YS[i]}
                  glow={isGlowRow}
                  glowProgress={p}
                  hideAvatars={!!seg.hideAvatars}
                />
              </g>
            );
          })}

        </g>{/* /camera transform */}
      </g>{/* /clip */}
    </svg>
  );
};

const JourneyRowComp: React.FC<{
  row: JourneyRow;
  y: number;
  glow: boolean;
  glowProgress?: number;
  hideAvatars?: boolean;
}> = ({ row, y, glow, glowProgress = 0, hideAvatars = false }) => {
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
      {hideAvatars ? null : row.useCustomIcon && row.customIconUrl ? (
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
