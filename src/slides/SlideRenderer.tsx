import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import type {
  IntroSegment, EmptySegment, SlideSegment, TextStyles,
} from '../types';
import { tokens } from '../tokens';
import { Img } from 'remotion';
import { getIntroModule, DEFAULT_INTRO_MODULE_ID } from '../intro-modules';
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

// ─── Intro slide (v3.28b.1) ───
// 10 module slide backgrounds (textless SVGs) with overlaid editable title.
// User picks a module (id stored as `moduleSlideId`); each module has its own
// title position (Y) and theme (light vs dark → text color auto-switches).
//
// v3.28b.1 changes:
//   - Subtitle removed entirely from intro slide.
//   - Title defaults to the picked module's display name if user hasn't typed one.
//
// Old projects with only `moduleIconId` keep working via a fallback to a default
// module slide design. The legacy icon-and-circle layout is no longer rendered.
export const IntroSlide: React.FC<{ seg: IntroSegment }> = ({ seg }) => {
  const frame = useCurrentFrame();

  const moduleId = seg.moduleSlideId || DEFAULT_INTRO_MODULE_ID;
  const mod = getIntroModule(moduleId) || getIntroModule(DEFAULT_INTRO_MODULE_ID);

  const anim = seg.animation || { kind: 'fade-up', durationMs: 600 };
  const animFrames = Math.max(1, Math.round((anim.durationMs ?? 600) / (1000 / 30)));

  let containerOpacity = 1, containerScale = 1;
  if (anim.kind === 'zoom' && frame < animFrames) {
    containerOpacity = interpolate(frame, [0, animFrames], [0, 1], { extrapolateRight: 'clamp' });
    containerScale = interpolate(frame, [0, animFrames], [0.9, 1], {
      extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
    });
  } else if (anim.kind === 'none') {
    containerOpacity = 1; containerScale = 1;
  }

  // Title fade-up (600ms)
  const TITLE_DUR = 18;
  let titleOpacity = 1, titleTranslateY = 0;
  if (anim.kind !== 'none' && frame < TITLE_DUR) {
    titleOpacity = interpolate(frame, [0, TITLE_DUR], [0, 1], { extrapolateRight: 'clamp' });
    titleTranslateY = interpolate(frame, [0, TITLE_DUR], [40, 0], {
      extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
    });
  }

  // Resolved values from the module config + segment overrides
  const title = seg.title || mod?.displayDefault || 'Intro Title';
  const titleY = mod?.titleY ?? 620;
  const titleColor = mod?.isLight ? '#002B54' : '#FFFFFF';

  return (
    <div style={{
      ...slideBase,
      position: 'relative',
      transform: `scale(${containerScale})`,
      opacity: containerOpacity,
      overflow: 'hidden',
    }}>
      {/* Module background — full-bleed 1920x1080 SVG */}
      {mod && (
        <Img
          src={mod.url}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Title overlay — positioned at module's titleY, centered horizontally,
          116px Satoshi Bold, color auto-switched for light/dark theme */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: titleY,
        width: '100%',
        textAlign: 'center',
        fontFamily: "'Satoshi', sans-serif",
        fontSize: 116,
        fontWeight: 700,
        lineHeight: 1.05,
        color: titleColor,
        whiteSpace: 'pre-line',
        opacity: titleOpacity,
        transform: `translateY(${titleTranslateY}px)`,
        padding: '0 60px',
        boxSizing: 'border-box',
        ...textStyle(seg.textStyles, 'title'),
      }}>
        {title}
      </div>
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
