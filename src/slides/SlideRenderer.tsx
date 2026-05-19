import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import type {
  IntroSegment, EmptySegment, SlideSegment, TextStyles,
} from '../types';
import { tokens } from '../tokens';
import { Img } from 'remotion';
import { getModuleIconUrl } from '../assets';
import { JourneySlideNew } from './JourneySlide';
import { FocusSlide } from './FocusSlide';
import { KeyGoalsSlide } from './KeyGoalsSlide';

// ─── Text style helper ───
function textStyle(styles: TextStyles | undefined, key: string): React.CSSProperties {
  if (!styles || !styles[key]) return {};
  const s = styles[key];
  const css: React.CSSProperties = {};
  if (s.fontSize) css.fontSize = s.fontSize;
  if (s.fontWeight) css.fontWeight = s.fontWeight;
  if (s.italic) css.fontStyle = 'italic';
  if (s.color) css.color = s.color;
  return css;
}

const slideBase: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex', flexDirection: 'column',
  color: '#fff', fontFamily: "'Satoshi', sans-serif",
};

// ─── Intro slide ───
// v3.28a: polished entry. Title fades up regardless of stored animation choice;
// subtitle staggers 300ms after the title's start. Icon container animates with the
// title. The legacy `seg.animation` field is respected for the OUTER container's
// initial entrance only (for back-compat with old decks that set zoom/none).
export const IntroSlide: React.FC<{ seg: IntroSegment }> = ({ seg }) => {
  const iconUrl = getModuleIconUrl(seg.moduleIconId);
  const frame = useCurrentFrame();
  const FPS = 30;

  // Container-level animation kept for legacy 'none' / 'zoom' decks.
  const anim = seg.animation || { kind: 'fade-up', durationMs: 600 };
  const animFrames = Math.max(1, Math.round((anim.durationMs ?? 600) / (1000 / FPS)));

  let containerOpacity = 1, containerScale = 1;
  if (anim.kind === 'zoom' && frame < animFrames) {
    containerOpacity = interpolate(frame, [0, animFrames], [0, 1], { extrapolateRight: 'clamp' });
    containerScale = interpolate(frame, [0, animFrames], [0.9, 1], {
      extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
    });
  } else if (anim.kind === 'none') {
    containerOpacity = 1; containerScale = 1;
  }

  // v3.28a: title fade-up from below. 600ms.
  const TITLE_DUR = 18; // 600ms @ 30fps
  let titleOpacity = 1, titleTranslateY = 0;
  if (anim.kind !== 'none' && frame < TITLE_DUR) {
    titleOpacity = interpolate(frame, [0, TITLE_DUR], [0, 1], { extrapolateRight: 'clamp' });
    titleTranslateY = interpolate(frame, [0, TITLE_DUR], [40, 0], {
      extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
    });
  }

  // v3.28a: subtitle fade-up, staggered 300ms after title start.
  const SUBTITLE_START = 9; // 300ms @ 30fps
  const SUBTITLE_DUR = 18;
  let subtitleOpacity = 1, subtitleTranslateY = 0;
  if (anim.kind !== 'none' && frame < SUBTITLE_START + SUBTITLE_DUR) {
    if (frame < SUBTITLE_START) {
      subtitleOpacity = 0;
      subtitleTranslateY = 30;
    } else {
      const local = frame - SUBTITLE_START;
      subtitleOpacity = interpolate(local, [0, SUBTITLE_DUR], [0, 1], { extrapolateRight: 'clamp' });
      subtitleTranslateY = interpolate(local, [0, SUBTITLE_DUR], [30, 0], {
        extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
      });
    }
  }

  return (
    <div style={{
      ...slideBase,
      background: `linear-gradient(135deg, ${tokens.navy900}, ${tokens.navy500})`,
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: 80,
      transform: `scale(${containerScale})`,
      opacity: containerOpacity,
    }}>
      <div style={{
        width: 240, height: 240, borderRadius: '50%',
        background: 'rgba(31,138,255,0.15)',
        border: `4px solid ${tokens.accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 48, overflow: 'hidden',
        opacity: titleOpacity,
        transform: `translateY(${titleTranslateY}px)`,
      }}>
        {iconUrl
          ? <Img src={iconUrl} style={{ width: '55%', height: '55%', objectFit: 'contain' }} />
          : <span style={{ fontSize: 140, color: '#fff' }}>★</span>
        }
      </div>
      <div style={{
        fontSize: 96, fontWeight: 700, lineHeight: 1.1,
        opacity: titleOpacity,
        transform: `translateY(${titleTranslateY}px)`,
        ...textStyle(seg.textStyles, 'title'),
      }}>
        {seg.title || 'Intro Title'}
      </div>
      {seg.subtitle && (
        <div style={{
          fontSize: 48, color: tokens.textDim, marginTop: 24, lineHeight: 1.2,
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleTranslateY}px)`,
          ...textStyle(seg.textStyles, 'subtitle'),
        }}>
          {seg.subtitle}
        </div>
      )}
    </div>
  );
};

// ─── Empty slide (unchanged) ───
export const EmptySlide: React.FC<{ seg: EmptySegment }> = ({ seg }) => {
  return (
    <div style={{
      ...slideBase,
      background: '#0a1929',
      alignItems: 'center', justifyContent: 'center',
      color: 'rgba(255,255,255,0.15)', fontSize: 48,
    }}>
      {seg.title || 'Empty slide'}
    </div>
  );
};

// ─── Dispatcher ───
export const SlideRenderer: React.FC<{ seg: SlideSegment; headerOpacity?: number }> = ({ seg, headerOpacity }) => {
  switch (seg.kind) {
    case 'slide-intro': return <IntroSlide seg={seg} />;
    case 'slide-journey': return <JourneySlideNew seg={seg} />;
    case 'slide-focus': return <FocusSlide seg={seg} />;
    case 'slide-keygoals': return <KeyGoalsSlide seg={seg} />;
    case 'slide-empty': return <EmptySlide seg={seg} />;
    default: return <EmptySlide seg={seg as EmptySegment} />;
  }
};
