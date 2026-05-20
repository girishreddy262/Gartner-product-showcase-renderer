import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { JourneySegment, JourneyRow } from '../types';
import { tokens } from '../tokens';
import { getPersonaById } from '../assets';
import { GlowTick, InactiveTick } from './Icons';
import { RRIVE_LOGO_DATA_URL } from '../embedded-logos';

/**
 * Journey slide — v3.22.
 *
 * Camera zoom (when seg.journeyZoom.enabled === true) is a LOCKED STANDARD:
 *   - Scale: 1.5x
 *   - Focal X: 1260 (tick column)
 *   - Focal Y: auto, follows the "centerpiece" row (latest activated, clamped to
 *     [1, N-2] so we always show the active row centered with one above + one below).
 *   - Zoom ramps in over 700ms (smoothstep). No zoom-out; slide fades to 0 over
 *     the last 600ms.
 *   - Camera pans between centerpieces over 700ms when active crosses a clamped
 *     boundary (only matters for 4+ rows).
 *
 * Per-row glow timing:
 *   - Camera enabled: glow-animate rows activate sequentially at
 *     PRE_ROLL_MS + idx * ROW_HOLD_MS. Each row eases in over GLOW_IN_MS.
 *   - Camera disabled: legacy — all glow-animate rows light up at 1.0-1.5s.
 *
 * Inactive ring is ALWAYS rendered. The GlowTick overlay (halo + filled blue +
 * white center + check) layers on top with opacity tied to per-row progress.
 *
 * Content (title + connectors + rows) is clipped to the inner card rectangle.
 * The outer navy bg + dark card-fill rect are static.
 */

const ROW_YS = [254.917, 398.592, 543.284, 687.888, 832.58];
const AVATAR_X = 1146.16;
const TICK_X = 1259.88;
const AVATAR_R = 41;
const CW = 1920;
const CH = 1080;

const ZOOM_SCALE = 1.5;
const FOCAL_X = 1260;
const ZOOM_RAMP_MS = 700;
const PAN_MS = 700;
const FADE_OUT_MS = 600;
const GLOW_IN_MS = 500;
const ROW_HOLD_MS = 1400;
const PRE_ROLL_MS = 1000; // v3.23: slide sits at scale 1 for 1.0s, then zoom + first glow fire together

const LEGACY_GLOW_START_MS = 1000;
const LEGACY_GLOW_END_MS = 1500;

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export const JourneySlideNew: React.FC<{ seg: JourneySegment }> = ({ seg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame / fps) * 1000;

  const rows = (seg.rows || []).slice(0, 5);
  const N = rows.length;
  // v3.28a: zoom is always on for Journey slides. The journeyZoom.enabled field is
  // ignored — old projects that had it set to false will now zoom (intentional, since
  // every Journey slide now has the standard zoom-in motion).
  const cameraEnabled = true;

  const HIGHLIGHT_N = Math.max(0, Math.min(seg.highlightUpToRow || 0, N));
  const glowStates: Array<'inactive' | 'glow-static' | 'glow-animate'> = rows.map((row, i) => {
    if (row.glowState) return row.glowState;
    if (HIGHLIGHT_N === 0) return 'inactive';
    if (i < HIGHLIGHT_N - 1) return 'glow-static';
    if (i === HIGHLIGHT_N - 1) return 'glow-animate';
    return 'inactive';
  });

  // v3.28: figure out the activeAt timing per row.
  // Old behavior (v3.22-3.27): activeAt = PRE_ROLL_MS + i * ROW_HOLD_MS. This caused a
  // visible delay when later rows (row 3, row 4) were the animating ones — the camera
  // would settle on the focal area, then sit idle until the animating row's "slot"
  // arrived. For a slide where rows 1-2 are glow-static and row 3 is glow-animate,
  // the user saw camera arrive at ~1.7s and glow only fire at ~3.8s.
  //
  // New behavior: a glow-animate row fires at PRE_ROLL_MS regardless of row index.
  // Static rows are already visible from frame 0 (return 1) — no sequencing needed.
  // If multiple rows are glow-animate (rare in practice — usually a single row at a
  // time per slide), they stagger by ROW_HOLD_MS starting from PRE_ROLL_MS.
  let animateOrdinal = 0;
  const rowProgress: number[] = rows.map((_row, i) => {
    const state = glowStates[i];
    if (state === 'inactive') return 0;
    if (state === 'glow-static') return 1;
    if (cameraEnabled) {
      const activeAt = PRE_ROLL_MS + animateOrdinal * ROW_HOLD_MS;
      animateOrdinal++;
      if (t < activeAt) return 0;
      if (t > activeAt + GLOW_IN_MS) return 1;
      return smoothstep((t - activeAt) / GLOW_IN_MS);
    }
    return smoothstep((t - LEGACY_GLOW_START_MS) / (LEGACY_GLOW_END_MS - LEGACY_GLOW_START_MS));
  });

  let scale = 1, txCam = 0, tyCam = 0;
  let headerOpacity = 1, slideOpacity = 1;

  if (cameraEnabled) {
    // v3.23: zoom-in starts at PRE_ROLL_MS (so the slide sits at scale 1 for 1.0s first)
    let zoomProgress: number;
    if (t < PRE_ROLL_MS) zoomProgress = 0;
    else if (t < PRE_ROLL_MS + ZOOM_RAMP_MS) zoomProgress = smoothstep((t - PRE_ROLL_MS) / ZOOM_RAMP_MS);
    else zoomProgress = 1;
    headerOpacity = 1 - zoomProgress;

    if (t > seg.durationMs - FADE_OUT_MS) {
      slideOpacity = Math.max(0, (seg.durationMs - t) / FADE_OUT_MS);
    }

    const minCp = N >= 3 ? 1 : 0;
    const maxCp = N >= 3 ? N - 2 : Math.max(0, N - 1);
    // v3.28: camera focal point uses the same animateOrdinal logic as glow timing
    // so the pan to the animating row happens right at PRE_ROLL_MS, not after
    // walking through static rows.
    const cpAt = (time: number): number => {
      let last = 0;
      let ordinal = 0;
      for (let i = 0; i < N; i++) {
        const state = glowStates[i];
        if (state === 'inactive') continue;
        if (state === 'glow-static') { last = Math.max(last, i); continue; }
        const activeAt = PRE_ROLL_MS + ordinal * ROW_HOLD_MS;
        ordinal++;
        if (time >= activeAt) last = Math.max(last, i);
      }
      return Math.max(minCp, Math.min(maxCp, last));
    };

    let focalY = ROW_YS[cpAt(0)];
    let prevCp = cpAt(0);
    // v3.28: walk transitions by animateOrdinal, not row index
    let ord = 0;
    for (let i = 0; i < N; i++) {
      const state = glowStates[i];
      if (state !== 'glow-animate') continue;
      const tCp = PRE_ROLL_MS + ord * ROW_HOLD_MS;
      ord++;
      const newCp = cpAt(tCp);
      if (newCp !== prevCp) {
        const targetY = ROW_YS[newCp];
        if (t >= tCp + PAN_MS) {
          focalY = targetY;
        } else if (t >= tCp) {
          focalY = focalY + (targetY - focalY) * smoothstep((t - tCp) / PAN_MS);
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
  }

  const titleLines = (seg.title || '').split('\n').filter(Boolean);
  const titleStartY = 280;
  const titleLineHeight = 90;
  const lastTitleY = titleStartY + Math.max(0, titleLines.length - 1) * titleLineHeight;
  const footerY = lastTitleY + 60;

  const connectorSegments: Array<{ y1: number; y2: number }> = [];
  if (N > 0) {
    connectorSegments.push({ y1: 113.888, y2: ROW_YS[0] - 22 });
    for (let i = 0; i < N - 1; i++) {
      connectorSegments.push({ y1: ROW_YS[i] + 22, y2: ROW_YS[i + 1] - 22 });
    }
    if (!seg.endJourney) {
      connectorSegments.push({ y1: ROW_YS[N - 1] + 22, y2: 966.888 });
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

      <rect width={1920} height={1080} fill={tokens.bgOuter} />
      <rect x={10} y={113.5} width={1900} height={853} rx={20} fill="black" fillOpacity={0.2} />

      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(${txCam} ${tyCam}) scale(${scale})`}>
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
                href={RRIVE_LOGO_DATA_URL}
              />
            )}
          </g>

          {connectorSegments.map((s, i) => (
            <path key={i} d={`M${TICK_X} ${s.y1} V${s.y2}`} stroke={tokens.cyan} strokeWidth={4} />
          ))}

          {rows.map((row, i) => (
            <JourneyRowComp
              key={row.id}
              row={row}
              y={ROW_YS[i]}
              glowProgress={rowProgress[i]}
            />
          ))}
        </g>
      </g>
    </svg>
  );
};

const JourneyRowComp: React.FC<{
  row: JourneyRow;
  y: number;
  glowProgress: number;
}> = ({ row, y, glowProgress }) => {
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

  const nameTextEndX = row.dual ? AVATAR_X - 92 : AVATAR_X - 56;

  return (
    <g>
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
      {designation && designation.split('\n').map((line, li) => (
        <text
          key={li}
          x={nameTextEndX} y={y + 21 + li * 22}
          textAnchor="end"
          fill={tokens.cyan}
          fontFamily="Satoshi, system-ui, sans-serif"
          fontSize={18} fontWeight={700}
        >
          {line}
        </text>
      ))}

      {row.useCustomIcon && row.customIconUrl ? (
        <RowCustomIcon iconUrl={row.customIconUrl} y={y} />
      ) : row.dual ? (
        <RowDualAvatar ids={ids} y={y} />
      ) : (
        <RowSingleAvatar id={ids[0]} y={y} />
      )}

      <InactiveTick cx={TICK_X} cy={y} />
      {glowProgress > 0.001 && (
        <GlowTick cx={TICK_X} cy={y} progress={glowProgress} />
      )}

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

const RowSingleAvatar: React.FC<{ id: string | null; y: number }> = ({ id, y }) => {
  const persona = getPersonaById(id);
  return (
    <g>
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
