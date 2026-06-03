import React, { useState, useEffect } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing, delayRender, continueRender } from 'remotion';
import type { FocusSegment, FocusColumn, FocusStatPill } from '../types';
import { tokens } from '../tokens';
import { ASSETS, getFocusIconUrl } from '../assets';
import { IconLocations, IconClients, IconConfigurable, IconBill } from './Icons';

/**
 * HR Focus Areas slide — supports 3 layout variations.
 *
 * V1 (bullets):    bg #032444, title 56px, 4 columns, each: icon → 2-line heading 32px → bullet list (cyan 22px)
 * V2 (pills):      bg #002B54, title 56px, columns centered (icon 100×100 + heading 28px), 1-3 stat pills bottom
 * V3 (stat bar):   bg #002B54, title 56px, 4 columns + 1 long stat bar with 4 segments
 *
 * Pill gradient: #0183FF → #0183FF @ 20% opacity, overall 80% opacity.
 * v3.28b.96: V2 pills are now DYNAMIC (1-3 count), matching the editor's
 * renderFocusSVG (v3.28b.88). Previously the renderer hardcoded exactly 2
 * FocusPill components, so deleting pills in the editor left phantom pills in
 * the MP4. Now we render statPills.slice(0,3) with the same count-based layout.
 */
export const FocusSlide: React.FC<{ seg: FocusSegment }> = ({ seg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const variation = seg.variation || 1;

  // v3.28b.96: Preload every remote icon URL before Remotion captures frames.
  // The column icons render as SVG <image href="https://...svg"> from GitHub
  // Pages. SVG <image> does NOT hook into Remotion's frame-readiness system, so
  // without this some frames are captured before an icon has decoded → it
  // renders blank → the intermittent flicker in the MP4. delayRender holds the
  // render until every icon (and the pill icons) has loaded; on error we still
  // continueRender so a single bad URL can't hang the whole render.
  const iconUrls = React.useMemo(() => {
    const urls = (seg.columns || [])
      .map(c => getFocusIconUrl(c.iconId))
      .filter((u): u is string => !!u);
    // pill icons (data URIs decode instantly but harmless to include)
    if (seg.variation === 2) {
      [ASSETS.pillIcons.globe, ASSETS.pillIcons.employees].forEach(u => { if (u) urls.push(u); });
    }
    return Array.from(new Set(urls));
  }, [seg.columns, seg.variation]);

  const [handle] = useState(() => delayRender('focus-icons'));
  useEffect(() => {
    if (iconUrls.length === 0) { continueRender(handle); return; }
    let done = 0;
    let cancelled = false;
    const finish = () => { if (!cancelled && ++done >= iconUrls.length) continueRender(handle); };
    iconUrls.forEach(url => {
      const img = new Image();
      img.onload = finish;
      img.onerror = finish; // don't hang the render on one bad icon
      img.src = url;
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, iconUrls]);

  const bgColor = variation === 1 ? tokens.bgOuterAlt : tokens.bgOuter;
  const cardRadius = variation === 1 ? 10 : 20;
  const cardY = variation === 1 ? 113.5 : 110;
  const cardH = variation === 1 ? 853 : 860;

  // Animation opt-in. Default 'stagger' = title fades, then cols fade in left→right.
  const animKind = seg.animation?.kind ?? 'stagger';
  const animOn = animKind !== 'none';

  const titleOpacity = animOn
    ? interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 1;
  const titleY = animOn
    ? interpolate(frame, [0, 0.4 * fps], [-10, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 0;

  // v3.28a polish: card (the dark inner background rect) slides up 30px on entry
  // alongside the title fade. Same timing window — 400ms.
  const cardSlideY = animOn
    ? interpolate(frame, [0, 0.4 * fps], [30, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 0;
  const cardOpacity = animOn
    ? interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 1;

  return (
    <svg
      viewBox="0 0 1920 1080"
      width="100%" height="100%"
      style={{ display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="focusBar" x1="228" y1="826" x2="1692" y2="826" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0183FF" />
          <stop offset="1" stopColor="#0183FF" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      <rect width={1920} height={1080} fill={bgColor} />
      <rect x={10} y={cardY + cardSlideY} width={1900} height={cardH} rx={cardRadius} fill="black" fillOpacity={0.2 * cardOpacity} />

      {/* Title (centered) — fades in */}
      <text
        x={960} y={265 + titleY} textAnchor="middle"
        fill="white"
        fontFamily="Satoshi, system-ui, sans-serif"
        fontSize={variation === 1 ? 52 : 56}
        fontWeight={700}
        opacity={titleOpacity}
      >
        {seg.title || ''}
      </text>

      {/* Columns */}
      {variation === 1 && <FocusV1Columns columns={seg.columns || []} animOn={animOn} />}
      {(variation === 2 || variation === 3) && <FocusV2V3Columns columns={seg.columns || []} animOn={animOn} />}

      {/* Stat pills (v2) — dynamic 1-3 count, matches editor */}
      {variation === 2 && <FocusV2Pills pills={seg.statPills || []} animOn={animOn} />}

      {/* Stat bar (v3) */}
      {variation === 3 && <FocusStatBar pills={seg.statPills || []} />}
    </svg>
  );
};

// Variation 1 layout — 1-4 columns with bullets (left-aligned text per column,
// whole group auto-centered on the slide).
const FocusV1Columns: React.FC<{ columns: FocusColumn[]; animOn: boolean }> = ({ columns, animOn }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cols = columns.slice(0, 5);
  const n = cols.length;
  // v3.28b.49: FIXED column width (280px = ~17 chars) + FIXED gap (60px). Max 5.
  // Cluster centers on canvas. Font sizes consistent across all counts.
  const COL_W = 280;
  const COL_GAP = 60;
  const clusterW = n > 0 ? (COL_W * n + COL_GAP * (n - 1)) : 0;
  const startX = Math.round(tokens.canvasW / 2 - clusterW / 2);
  const headingSize = 32;
  const bodySize = 22;
  return (
    <g>
      {cols.map((col, i) => {
        const xLeft = Math.round(startX + i * (COL_W + COL_GAP));
        const colStart = (0.4 + i * 0.15) * fps;
        const colEnd = colStart + 0.4 * fps;
        const opacity = animOn
          ? interpolate(frame, [colStart, colEnd], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          : 1;
        const ty = animOn
          ? interpolate(frame, [colStart, colEnd], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          : 0;
        const headingLines = (col.heading || '').split('\n');
        const bulletLines = (col.body || '').split('\n').filter(Boolean);
        return (
          <g key={col.id} opacity={opacity} transform={`translate(0, ${ty})`}>
            {getFocusIconUrl(col.iconId) && (
              <image
                x={xLeft} y={386} width={80} height={80}
                href={getFocusIconUrl(col.iconId)!}
                preserveAspectRatio="xMidYMid meet"
              />
            )}
            {headingLines.map((line, idx) => (
              <text
                key={idx}
                x={xLeft} y={540 + idx * 40}
                fill="white"
                fontFamily="Satoshi, system-ui, sans-serif"
                fontSize={headingSize} fontWeight={700}
              >
                {line}
              </text>
            ))}
            {bulletLines.map((line, idx) => (
              <text
                key={idx}
                x={xLeft} y={635 + idx * 35}
                fill={tokens.cyan}
                fontFamily="Satoshi, system-ui, sans-serif"
                fontSize={bodySize} fontWeight={500}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
};

// Variation 2/3 layout — 1-6 columns center-aligned per column,
// whole group auto-centered on the slide.
const FocusV2V3Columns: React.FC<{ columns: FocusColumn[]; animOn: boolean }> = ({ columns, animOn }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cols = columns.slice(0, 6);
  const n = cols.length;
  // v3.28b.47: V2 — text is center-aligned per column (original V2 design).
  // Group is centered on the slide.
  const innerWidth = n <= 3 ? 1100 : n === 4 ? 1400 : n === 5 ? 1600 : 1700;
  const COL_PITCH = n > 0 ? innerWidth / n : 0;
  const firstCx = tokens.canvasW / 2 - innerWidth / 2 + COL_PITCH / 2;
  const headingSize = n <= 4 ? 28 : (n === 5 ? 22 : 18);
  return (
    <g>
      {cols.map((col, i) => {
        const cx = Math.round(firstCx + i * COL_PITCH);
        const colStart = (0.4 + i * 0.15) * fps;
        const colEnd = colStart + 0.4 * fps;
        const opacity = animOn
          ? interpolate(frame, [colStart, colEnd], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          : 1;
        const ty = animOn
          ? interpolate(frame, [colStart, colEnd], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          : 0;
        const headingLines = (col.heading || '').split('\n');
        const iconX = cx - 50; // 100px-wide icon, centered on column
        return (
          <g key={col.id} opacity={opacity} transform={`translate(0, ${ty})`}>
            {/* v3.28b.8: icon background rect removed — icon sits directly on slide bg */}
            {getFocusIconUrl(col.iconId) && (
              <image
                x={iconX} y={395} width={100} height={100}
                href={getFocusIconUrl(col.iconId)!}
                preserveAspectRatio="xMidYMid meet"
              />
            )}
            {headingLines.map((line, idx) => (
              <text
                key={idx}
                x={cx}
                y={555 + idx * 35}
                textAnchor="middle"
                fill="white"
                fontFamily="Satoshi, system-ui, sans-serif"
                fontSize={headingSize} fontWeight={700}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
};

// v3.28b.96: Variation 2 pills — DYNAMIC 1-3 count, mirrors editor.html
// renderFocusSVG (v3.28b.88). Renders statPills.slice(0,3); count drives layout:
//   1 pill  → centered (x=676, w=567)
//   2 pills → x=358/w=567 and x=1020/w=543
//   3 pills → three equal 425px pills spread across canvas
// Per-pill gradient fades #0183FF (left) → 20% opacity (right). Icons:
// [globe, employees, globe]. Pills fade in 0.8-1.2s (after columns). When the
// user deletes pills, statPills shrinks, so no phantom pills render — fixes the
// MP4 showing deleted pills.
const FocusV2Pills: React.FC<{ pills: FocusStatPill[]; animOn: boolean }> = ({ pills, animOn }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v2pills = (pills || []).slice(0, 3);
  const n = v2pills.length;
  if (n === 0) return null;

  // Pills fade in 0.8-1.2s, matching editor's pillsOp window
  const pillsOpacity = animOn
    ? interpolate(frame, [0.8 * fps, 1.2 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 1;

  let layouts: { x: number; w: number }[];
  if (n === 1) {
    layouts = [{ x: 676, w: 567 }];
  } else if (n === 2) {
    layouts = [{ x: 358, w: 567 }, { x: 1020, w: 543 }];
  } else {
    const PILL_W = 425;
    const GAP = 50;
    const total = PILL_W * 3 + GAP * 2; // 1375
    const x0 = (1920 - total) / 2;      // 272.5
    layouts = [
      { x: x0, w: PILL_W },
      { x: x0 + (PILL_W + GAP), w: PILL_W },
      { x: x0 + 2 * (PILL_W + GAP), w: PILL_W },
    ];
  }

  // Icon order matches editor: [globe, employees, globe]
  const PILL_ICONS = [ASSETS.pillIcons.globe, ASSETS.pillIcons.employees, ASSETS.pillIcons.globe];

  return (
    <g opacity={pillsOpacity}>
      <defs>
        {layouts.map((L, i) => (
          <linearGradient
            key={i}
            id={`fp_v2_${i}`}
            x1={L.x} y1={808} x2={L.x + L.w} y2={808}
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#0183FF" />
            <stop offset="1" stopColor="#0183FF" stopOpacity="0.2" />
          </linearGradient>
        ))}
      </defs>
      {v2pills.map((p, i) => {
        const L = layouts[i];
        const icon = PILL_ICONS[i];
        return (
          <g key={(p && p.id) || i}>
            <rect x={L.x} y={764} width={L.w} height={88} rx={44} fill={`url(#fp_v2_${i})`} fillOpacity={0.8} />
            {icon && (
              <image
                x={L.x + 38} y={786} width={44} height={44}
                href={icon}
                preserveAspectRatio="xMidYMid meet"
              />
            )}
            <text
              x={L.x + 100} y={816}
              fill="white"
              fontFamily="Satoshi, system-ui, sans-serif"
              fontSize={32} fontWeight={700}
            >
              {(p && p.text) || ''}
            </text>
          </g>
        );
      })}
    </g>
  );
};

// Variation 3 long stat bar (4 segments)
const FocusStatBar: React.FC<{ pills: FocusStatPill[] }> = ({ pills }) => {
  const items = pills.slice(0, 4);
  const segmentXs = [290, 656, 1022, 1388];
  const dividerXs = [594, 960, 1326];
  // Default icon order if not specified
  const defaultKinds = ['clients', 'locations', 'configurable', 'bill'] as const;
  return (
    <g>
      <rect x={228} y={756} width={1464} height={140} rx={70} fill="url(#focusBar)" fillOpacity={0.8} />
      {dividerXs.map(x => (
        <line key={x} x1={x} y1={786} x2={x} y2={866} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
      ))}
      {items.map((pill, i) => {
        // Combine text + legacy text2 for backward compat
        const fullText = pill.text2 ? `${pill.text || ''}\n${pill.text2}` : (pill.text || '');
        const lines = fullText.split('\n').filter(s => s.length > 0);
        const kind = pill.iconKind || defaultKinds[i];
        return (
          <g key={pill.id}>
            <foreignObject x={segmentXs[i]} y={790} width={70} height={70}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <StatBarIcon kind={kind} customUrl={pill.iconUrl} />
              </div>
            </foreignObject>
            {lines.length === 1 && (
              <text
                x={segmentXs[i] + 90} y={832}
                fill="white"
                fontFamily="Satoshi, system-ui, sans-serif"
                fontSize={26} fontWeight={700}
              >
                {lines[0]}
              </text>
            )}
            {lines.length >= 2 && (
              <>
                <text
                  x={segmentXs[i] + 90} y={816}
                  fill="white"
                  fontFamily="Satoshi, system-ui, sans-serif"
                  fontSize={26} fontWeight={700}
                >
                  {lines[0]}
                </text>
                <text
                  x={segmentXs[i] + 90} y={848}
                  fill="white"
                  fontFamily="Satoshi, system-ui, sans-serif"
                  fontSize={22} fontWeight={500}
                >
                  {lines[1]}
                </text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
};

const StatBarIcon: React.FC<{ kind: string; customUrl?: string | null }> = ({ kind, customUrl }) => {
  if (kind === 'custom' && customUrl) {
    return <img src={customUrl} alt="" style={{ height: 48, width: 'auto' }} />;
  }
  switch (kind) {
    case 'locations': return <IconLocations size={48} />;
    case 'clients': return <IconClients size={48} />;
    case 'configurable': return <IconConfigurable size={48} />;
    case 'bill': return <IconBill size={48} />;
    default: return <IconClients size={48} />;
  }
};
