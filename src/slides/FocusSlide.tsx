import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { FocusSegment, FocusColumn, FocusStatPill } from '../types';
import { tokens } from '../tokens';
import { ASSETS, getFocusIconUrl } from '../assets';
import { IconLocations, IconClients, IconConfigurable, IconBill } from './Icons';

/**
 * HR Focus Areas slide — supports 3 layout variations.
 *
 * V1 (bullets):    bg #032444, title 56px, 4 columns, each: icon → 2-line heading 32px → bullet list (cyan 22px)
 * V2 (2 pills):    bg #002B54, title 56px, 4 columns centered (icon 100×100 + heading 28px), 2 stat pills bottom
 * V3 (stat bar):   bg #002B54, title 56px, 4 columns + 1 long stat bar with 4 segments
 *
 * Pill gradient: #0183FF → #0183FF @ 20% opacity, overall 80% opacity.
 * Pill 1 (v2): x=358, y=764, w=567, h=88, rx=44
 * Pill 2 (v2): x=1020, y=764, w=543, h=88, rx=44
 * Stat bar (v3): x=228, y=756, w=1464, h=140, rx=70
 */
export const FocusSlide: React.FC<{ seg: FocusSegment }> = ({ seg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const variation = seg.variation || 1;
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
        <linearGradient id="focusPill1" x1="358" y1="808" x2="925" y2="808" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0183FF" />
          <stop offset="1" stopColor="#0183FF" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="focusPill2" x1="1020" y1="808" x2="1563" y2="808" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0183FF" />
          <stop offset="1" stopColor="#0183FF" stopOpacity="0.2" />
        </linearGradient>
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

      {/* Stat pills (v2) */}
      {variation === 2 && (
        <>
          <FocusPill x={358} y={764} w={567} h={88} text={(seg.statPills && seg.statPills[0]?.text) || ''} gradientId="focusPill1" />
          <FocusPill x={1020} y={764} w={543} h={88} text={(seg.statPills && seg.statPills[1]?.text) || ''} gradientId="focusPill2" />
        </>
      )}

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
  const cols = columns.slice(0, 6);
  const n = cols.length;
  // v3.28b.46: center-align each column's icon + heading + body around its center
  // point. Group is centered on the slide. Pitch tightened for cleaner layout.
  const innerWidth = n <= 3 ? 1100 : n === 4 ? 1400 : n === 5 ? 1600 : 1700;
  const COL_PITCH = n > 0 ? innerWidth / n : 0;
  const firstCx = tokens.canvasW / 2 - innerWidth / 2 + COL_PITCH / 2;
  const headingSize = n <= 4 ? 30 : (n === 5 ? 26 : 22);
  const bodySize = n <= 4 ? 22 : (n === 5 ? 18 : 16);
  const headingLineH = n <= 4 ? 38 : (n === 5 ? 32 : 28);
  const bodyLineH = n <= 4 ? 35 : (n === 5 ? 28 : 24);
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
        const bulletLines = (col.body || '').split('\n').filter(Boolean);
        return (
          <g key={col.id} opacity={opacity} transform={`translate(0, ${ty})`}>
            {getFocusIconUrl(col.iconId) && (
              <image
                x={cx - 40} y={386} width={80} height={80}
                href={getFocusIconUrl(col.iconId)!}
                preserveAspectRatio="xMidYMid meet"
              />
            )}
            {headingLines.map((line, idx) => (
              <text
                key={idx}
                x={cx} y={540 + idx * headingLineH}
                textAnchor="middle"
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
                x={cx} y={640 + idx * bodyLineH}
                textAnchor="middle"
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

// Variation 2/3 layout — 1-4 columns center-aligned per column,
// whole group auto-centered on the slide.
const FocusV2V3Columns: React.FC<{ columns: FocusColumn[]; animOn: boolean }> = ({ columns, animOn }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cols = columns.slice(0, 6);
  const n = cols.length;
  // v3.28b.46: tighter centered pitch
  const innerWidth = n <= 3 ? 1100 : n === 4 ? 1400 : n === 5 ? 1600 : 1700;
  const COL_PITCH = n > 0 ? innerWidth / n : 0;
  const firstCx = tokens.canvasW / 2 - innerWidth / 2 + COL_PITCH / 2;
  const headingSize = n <= 4 ? 28 : (n === 5 ? 22 : 18);
  const headingLineH = n <= 4 ? 35 : (n === 5 ? 28 : 24);
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
                y={555 + idx * headingLineH}
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

// Single stat pill (used by v2)
const FocusPill: React.FC<{
  x: number; y: number; w: number; h: number;
  text: string; gradientId: string;
}> = ({ x, y, w, h, text, gradientId }) => {
  // v3.28b.8: fixed icons baked into V2 pills (same pattern as V3 stat bar).
  // Convention: pill 1 (left, gradientId="focusPill1") = Globe.
  //             pill 2 (right, gradientId="focusPill2") = Employees.
  const iconHref =
    gradientId === 'focusPill1' ? ASSETS.pillIcons.globe :
    gradientId === 'focusPill2' ? ASSETS.pillIcons.employees :
    null;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={44} fill={`url(#${gradientId})`} fillOpacity={0.8} />
      {iconHref && (
        <image
          x={x + 38} y={y + 22}
          width={44} height={44}
          href={iconHref}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      <text
        x={x + 100} y={y + 52}
        fill="white"
        fontFamily="Satoshi, system-ui, sans-serif"
        fontSize={32} fontWeight={700}
      >
        {text}
      </text>
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
