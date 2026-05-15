import React from 'react';
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

// ─── Intro slide (unchanged from original — works fine) ───
export const IntroSlide: React.FC<{ seg: IntroSegment }> = ({ seg }) => {
  const iconUrl = getModuleIconUrl(seg.moduleIconId);
  return (
    <div style={{
      ...slideBase,
      background: `linear-gradient(135deg, ${tokens.navy900}, ${tokens.navy500})`,
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: 80,
    }}>
      <div style={{
        width: 240, height: 240, borderRadius: '50%',
        background: 'rgba(31,138,255,0.15)',
        border: `4px solid ${tokens.accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 48, overflow: 'hidden',
      }}>
        {iconUrl
          ? <Img src={iconUrl} style={{ width: '55%', height: '55%', objectFit: 'contain' }} />
          : <span style={{ fontSize: 140, color: '#fff' }}>★</span>
        }
      </div>
      <div style={{
        fontSize: 96, fontWeight: 700, lineHeight: 1.1,
        ...textStyle(seg.textStyles, 'title'),
      }}>
        {seg.title || 'Intro Title'}
      </div>
      {seg.subtitle && (
        <div style={{
          fontSize: 48, color: tokens.textDim, marginTop: 24, lineHeight: 1.2,
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
export const SlideRenderer: React.FC<{ seg: SlideSegment }> = ({ seg }) => {
  switch (seg.kind) {
    case 'slide-intro': return <IntroSlide seg={seg} />;
    case 'slide-journey': return <JourneySlideNew seg={seg} />;
    case 'slide-focus': return <FocusSlide seg={seg} />;
    case 'slide-keygoals': return <KeyGoalsSlide seg={seg} />;
    case 'slide-empty': return <EmptySlide seg={seg} />;
    default: return <EmptySlide seg={seg as EmptySegment} />;
  }
};
