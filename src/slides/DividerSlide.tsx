import React from 'react';
import { useCurrentFrame, interpolate, Easing, Img } from 'remotion';
import type { DividerSegment } from '../types';
import { tokens } from '../tokens';
import { getDividerIcon, DEFAULT_DIVIDER_ICON_ID } from '../divider-icons';

/**
 * v3.28b.2 — Divider Slide
 *
 * Layout:
 *   - Background: #EDF6FF (light blue, same as Intro slides)
 *   - Icon (centered horizontally, baseline-aligned at fixed bottom Y)
 *   - 12px gap
 *   - Subtitle (Satoshi Bold 60, #0183FF, centered, optional)
 *   - 12px gap
 *   - Title (Satoshi Bold 116, #003B73, centered, multi-line, optional)
 *
 * Group is vertically centered as a whole. Hiding subtitle or title removes
 * its row and the 12px gap below it, recentering the remaining elements.
 *
 * Icon baseline rule: All icons sit in a fixed 280x220 container with
 * align-items:flex-end. So a tall icon and a short icon both rest on the
 * same bottom edge regardless of their intrinsic size.
 */
export const DividerSlide: React.FC<{ seg: DividerSegment }> = ({ seg }) => {
  const frame = useCurrentFrame();

  // Resolve icon (fallback to default if missing)
  const iconId = seg.iconId || DEFAULT_DIVIDER_ICON_ID;
  const icon = getDividerIcon(iconId) || getDividerIcon(DEFAULT_DIVIDER_ICON_ID);

  // Animation — fade-up (600ms)
  const ANIM_DUR = 18; // 30fps * 0.6s
  let opacity = 1;
  let translateY = 0;
  if (frame < ANIM_DUR) {
    opacity = interpolate(frame, [0, ANIM_DUR], [0, 1], { extrapolateRight: 'clamp' });
    translateY = interpolate(frame, [0, ANIM_DUR], [40, 0], {
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
  }

  const hasSubtitle = (seg.subtitle || '').trim().length > 0;
  const hasTitle = (seg.title || '').trim().length > 0;

  return (
    <div
      style={{
        position: 'relative',
        width: tokens.canvasW,
        height: tokens.canvasH,
        background: '#EDF6FF',
        overflow: 'hidden',
      }}
    >
      {/* Vertically-centered flex column of (icon, subtitle, title) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {/* Icon container — fixed 280x220, icon baseline-aligned to bottom */}
        <div
          style={{
            width: 280,
            height: 220,
            display: 'flex',
            alignItems: 'flex-end',     // ← baseline alignment
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          {icon && (
            <Img
              src={icon.url}
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
              }}
            />
          )}
        </div>

        {/* Subtitle (Bold 60, #0183FF) — optional */}
        {hasSubtitle && (
          <div
            style={{
              color: '#0183FF',
              fontFamily: "'Satoshi', sans-serif",
              fontWeight: 700,
              fontSize: 60,
              lineHeight: 1.1,
              textAlign: 'center',
              whiteSpace: 'pre-line',
              marginBottom: hasTitle ? 12 : 0,
              padding: '0 60px',
            }}
          >
            {seg.subtitle}
          </div>
        )}

        {/* Title (Bold 116, #003B73, multi-line) — optional */}
        {hasTitle && (
          <div
            style={{
              color: '#003B73',
              fontFamily: "'Satoshi', sans-serif",
              fontWeight: 700,
              fontSize: 116,
              lineHeight: 1.05,
              textAlign: 'center',
              whiteSpace: 'pre-line',
              padding: '0 60px',
            }}
          >
            {seg.title}
          </div>
        )}
      </div>
    </div>
  );
};
