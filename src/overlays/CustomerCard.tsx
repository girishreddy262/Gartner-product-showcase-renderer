import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import type { CustomerCardOverlay } from '../types';
import { resolveCustomerLogoById } from '../customer-logos';
import { resolveCustomerLogo as resolveCustomerLogoUrl } from '../embedded-logos';

/**
 * v3.28b Patch 1 — Customer Card overlay (full redesign).
 *
 * Card spec:
 *   - Width: 388 (fixed)
 *   - Height: auto-grows with body text. Min 400. 40px gap from last text line to bottom.
 *   - White background, 2px #0183FF border, 20px corner radius
 *   - Drop shadow: #0183FF @ 30% opacity, x=8, y=8, blur=0 (sharp blue offset)
 *   - Stats band: #ECF6FF, X=2..336 (insets right ~50px), Y=123..246
 *   - Icons: 3 path-based icons from the original Figma SVG
 *   - Stats text: Satoshi Bold 16, color #1F2431, positioned 13px right of each icon
 *   - Body text: width 300px, Satoshi Medium 16px, color #1F2431
 *   - Body supports newlines and bullet lines (lines starting with `-` or `•`)
 *
 * Animations: slide-right in / out (default for v3.28b). Old fade/scale/etc still
 * work for back-compat with v3.27 saved projects.
 *
 * The card auto-resizes: we render a measuring pass via Remotion's render context
 * (effectively just laying out the body div and using its offsetHeight). Since
 * Remotion renders deterministically, JS sizing in a render frame works the same
 * way as in the editor.
 */
export const CustomerCardComp: React.FC<{
  card: CustomerCardOverlay;
  startFrame: number;
  durationFrames: number;
}> = ({ card, startFrame, durationFrames }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  const animInDur = Math.max(1, Math.round((card.animInAt || 0.3) * 30));
  const animOutDur = Math.max(1, Math.round((card.animOutAt || 0.3) * 30));
  const outStart = Math.max(0, durationFrames - animOutDur);

  let opacity = 1;
  let translateY = 0;
  let translateX = 0;

  // ─── IN animations (v3.28b default: slide-right; rest kept for back-compat) ───
  if (localFrame < animInDur) {
    if (card.animIn === 'slide-right' || !card.animIn) {
      opacity = interpolate(localFrame, [0, animInDur], [0, 1], { extrapolateRight: 'clamp' });
      translateX = interpolate(localFrame, [0, animInDur], [200, 0], {
        extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
      });
    } else if (card.animIn === 'slide-left') {
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
    if (card.animOut === 'slide-right' || card.animOut === 'slide-out-right' || !card.animOut) {
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

  // Resolve logo: prefer customerLogoId, fall back to logoUrl, fall back to legacy resolver
  const resolvedLogo =
    resolveCustomerLogoById(card.customerLogoId) ||
    resolveCustomerLogoUrl(card.logoUrl);

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
        logoUrl={resolvedLogo || undefined}
        employees={card.employees}
        industry={card.industry}
        location={card.location}
        body={card.body}
      />
    </div>
  );
};

/**
 * Pure renderer for the v3.28b card design.
 *
 * Approach:
 *   - The card body is a real CSS structure (not a fixed-height SVG), so it
 *     grows naturally with text content.
 *   - The blue border + light-blue stats band are SVG-rendered to keep the
 *     exact corner-radius geometry and the inset stats band shape.
 *   - Body text is rendered as a div with bullet-list support.
 *   - Drop shadow uses CSS filter (cleanest cross-browser behavior).
 *
 * Reusable in both renderer and editor preview.
 */
export const CustomerCardSvg: React.FC<{
  logoUrl?: string;
  employees: string;
  industry: string;
  location: string;
  body: string;
}> = ({ logoUrl, employees, industry, location, body }) => {
  // Body text container is fixed 300px wide.
  // Estimate body height: 16px font, 1.45 line-height = ~23px per line.
  // For deterministic render-time sizing we'll use min-height instead of
  // measuring — the card itself uses min-height: 400 and grows naturally.

  return (
    <div
      style={{
        // Card outer wrapper — 388 wide, auto height
        position: 'relative',
        width: 388,
        // Drop shadow per spec: #0183FF @ 30% opacity, x=8 y=8 blur=0
        filter: 'drop-shadow(8px 8px 0 rgba(1, 131, 255, 0.3))',
      }}
    >
      <div
        style={{
          // The card itself — white bg, blue border, rounded corners, auto height
          position: 'relative',
          background: '#FFFFFF',
          border: '2px solid #0183FF',
          borderRadius: 20,
          minHeight: 400,
          overflow: 'hidden',
        }}
      >
        {/* Logo area — left-aligned in top region, 200px max width / 70px height */}
        <div style={{
          position: 'relative',
          height: 76,
          margin: '30px 30px 14px 30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              style={{
                maxWidth: 200,
                maxHeight: '100%',
                objectFit: 'contain',
                objectPosition: 'left center',
              }}
            />
          ) : (
            <div style={{
              fontFamily: "'Satoshi', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: '#999',
            }}>
              Logo
            </div>
          )}
        </div>

        {/* Stats band — light blue, inset right ~50px to match design */}
        <div style={{
          position: 'relative',
          height: 123,
          background: '#ECF6FF',
          marginRight: 52,                  // matches original SVG band X=2..336
          borderTopRightRadius: 12,
          borderBottomRightRadius: 12,
        }}>
          {/* People icon (top-left of band, vert center y=38 inside band ≈ Y=161 on card) */}
          <svg
            width={24} height={20}
            viewBox="0 0 24 20"
            style={{ position: 'absolute', left: 41, top: 28 }}
            fill="#0183FF"
          >
            <path d="M9 11c2.21 0 4-1.79 4-4S11.21 3 9 3 5 4.79 5 7s1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4zm8.5-1c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm0 2c-.74 0-1.51.13-2.27.34.94.87 1.77 2.05 1.77 3.66v2h5v-3c0-1.92-3.5-3-4.5-3z"/>
          </svg>
          {/* Industry icon (top-right of band) */}
          <svg
            width={22} height={20}
            viewBox="0 0 22 20"
            style={{ position: 'absolute', left: 152, top: 26 }}
            fill="#0183FF"
          >
            <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>
          </svg>
          {/* Location icon (bottom-left of band) */}
          <svg
            width={20} height={24}
            viewBox="0 0 20 24"
            style={{ position: 'absolute', left: 41, top: 72 }}
            fill="#0183FF"
          >
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" transform="translate(-2, -2)"/>
          </svg>

          {/* Stat labels — 13px right of each icon's right edge */}
          <div style={{
            position: 'absolute',
            left: 78,  // 65 (icon right) + 13
            top: 28,
            height: 21,
            display: 'flex',
            alignItems: 'center',
            color: '#1F2431',
            fontFamily: "'Satoshi', sans-serif",
            fontWeight: 700,
            fontSize: 16,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 80,
          }}>{employees || ''}</div>
          <div style={{
            position: 'absolute',
            left: 187, // 174 (icon right) + 13
            top: 26,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            color: '#1F2431',
            fontFamily: "'Satoshi', sans-serif",
            fontWeight: 700,
            fontSize: 16,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 130,
          }}>{industry || ''}</div>
          <div style={{
            position: 'absolute',
            left: 76,  // 63 (icon right) + 13
            top: 76,
            height: 21,
            display: 'flex',
            alignItems: 'center',
            color: '#1F2431',
            fontFamily: "'Satoshi', sans-serif",
            fontWeight: 700,
            fontSize: 16,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 260,
          }}>{location || ''}</div>
        </div>

        {/* Body text area — 22px top gap to stats band, 40px bottom gap to card edge */}
        <div style={{
          padding: '22px 30px 40px 30px',
        }}>
          <CustomerCardBody body={body} />
        </div>
      </div>
    </div>
  );
};

/**
 * Body text renderer with bullet support.
 *
 * Lines starting with "- " or "• " become bullet list items.
 * Plain lines render as regular paragraphs with line breaks preserved.
 */
const CustomerCardBody: React.FC<{ body: string }> = ({ body }) => {
  const lines = (body || '').split('\n');

  // Walk lines and group consecutive bullet lines into a single <ul>
  const blocks: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  const flushBullets = () => {
    if (bulletBuffer.length > 0) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} style={{ margin: 0, paddingLeft: 20 }}>
          {bulletBuffer.map((b, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{b}</li>
          ))}
        </ul>
      );
      bulletBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*[-•]\s+(.*)$/);
    if (m) {
      bulletBuffer.push(m[1]);
    } else {
      flushBullets();
      if (line.trim() === '') {
        blocks.push(<br key={`br-${i}`} />);
      } else {
        blocks.push(
          <div key={`p-${i}`} style={{ marginBottom: 0 }}>{line}</div>
        );
      }
    }
  }
  flushBullets();

  return (
    <div style={{
      width: 300,                       // v3.28b: 300px fixed width per spec
      color: '#1F2431',
      fontFamily: "'Satoshi', sans-serif",
      fontWeight: 500,                  // medium
      fontSize: 16,                     // 16px
      lineHeight: 1.45,
      wordWrap: 'break-word',
    }}>
      {blocks}
    </div>
  );
};
