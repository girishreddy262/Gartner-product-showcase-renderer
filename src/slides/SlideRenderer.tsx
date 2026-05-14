import React from 'react';
import { Img, staticFile } from 'remotion';
import type {
  IntroSegment, JourneySegment, FocusSegment,
  KeyGoalsSegment, EmptySegment, SlideSegment, TextStyles,
} from '../types';
import { tokens } from '../tokens';
import { getModuleIconUrl, getFocusIconUrl, getPersonaById, ASSETS } from '../assets';

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

// ─── Shared base ───
const slideBase: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex', flexDirection: 'column',
  color: '#fff', fontFamily: "'Satoshi', sans-serif",
};

// ════════════════════════════════════════
// INTRO SLIDE
// ════════════════════════════════════════
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

// ════════════════════════════════════════
// JOURNEY SLIDE
// ════════════════════════════════════════
export const JourneySlide: React.FC<{ seg: JourneySegment }> = ({ seg }) => {
  return (
    <div style={{
      ...slideBase,
      background: `linear-gradient(135deg, ${tokens.navy700}, ${tokens.accent})`,
      alignItems: 'center', justifyContent: 'flex-start',
      padding: '80px 100px',
    }}>
      <div style={{
        fontSize: 72, fontWeight: 700, marginBottom: 48,
        color: '#fff', textAlign: 'center', width: '100%',
        ...textStyle(seg.textStyles, 'title'),
      }}>
        {seg.title || 'Journey'}
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 24,
        width: '100%', maxWidth: 1600,
      }}>
        {(seg.rows || []).map((row, i) => {
          const ids = row.dual
            ? (row.personaIds || [null, null]).slice(0, 2)
            : [(row.personaIds || [null])[0]];

          let nameText = row.name || 'Persona';
          if (row.dual && ids.length === 2 && !row.name) {
            const p1 = getPersonaById(ids[0]);
            const p2 = getPersonaById(ids[1]);
            if (p1 && p2) nameText = `${p1.name} & ${p2.name}`;
          } else if (!row.name) {
            const p = getPersonaById(ids[0]);
            if (p) nameText = p.name;
          }

          let designation = row.designation || '';
          if (!designation) {
            const p = getPersonaById(ids[0]);
            if (p) designation = p.designation;
          }

          return (
            <div key={row.id} style={{
              display: 'flex', alignItems: 'center', gap: 32,
              padding: '24px 32px',
              background: 'rgba(0,0,0,0.25)', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
            }}>
              <div style={{ display: 'flex', flexShrink: 0 }}>
                {ids.map((pid, slot) => {
                  const p = getPersonaById(pid);
                  return (
                    <div key={slot} style={{
                      width: 100, height: 100, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.08)',
                      border: '3px solid #fff',
                      overflow: 'hidden', flexShrink: 0,
                      marginLeft: slot > 0 ? -20 : 0,
                    }}>
                      {p
                        ? <Img src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{
                            width: '100%', height: '100%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'rgba(255,255,255,0.5)', fontSize: 32,
                          }}>?</div>
                      }
                    </div>
                  );
                })}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 32, fontWeight: 700, color: '#fff',
                  ...textStyle(seg.textStyles, `row.${i}.name`),
                }}>
                  {nameText}
                </div>
                {designation && (
                  <div style={{
                    fontSize: 22, color: 'rgba(255,255,255,0.7)', marginTop: 2,
                    ...textStyle(seg.textStyles, `row.${i}.designation`),
                  }}>
                    {designation}
                  </div>
                )}
                {row.description && (
                  <div style={{
                    fontSize: 24, color: 'rgba(255,255,255,0.85)',
                    marginTop: 8, lineHeight: 1.3,
                    ...textStyle(seg.textStyles, `row.${i}.description`),
                  }}>
                    {row.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ════════════════════════════════════════
// FOCUS AREAS SLIDE
// ════════════════════════════════════════
export const FocusSlide: React.FC<{ seg: FocusSegment }> = ({ seg }) => {
  return (
    <div style={{
      ...slideBase,
      background: `linear-gradient(135deg, ${tokens.navy900}, ${tokens.navy700})`,
      alignItems: 'center', justifyContent: 'flex-start',
      padding: '80px 100px',
    }}>
      <div style={{
        fontSize: 72, fontWeight: 700, marginBottom: 64,
        color: '#fff', textAlign: 'center', width: '100%',
        ...textStyle(seg.textStyles, 'title'),
      }}>
        {seg.title || 'Focus Areas'}
      </div>
      <div style={{
        display: 'flex', gap: 28, width: '100%', maxWidth: 1700,
        justifyContent: 'center',
      }}>
        {(seg.columns || []).map((col, i) => {
          const iconUrl = getFocusIconUrl(col.iconId);
          return (
            <div key={col.id} style={{
              flex: 1, minWidth: 0,
              background: 'rgba(31,138,255,0.12)',
              border: '1px solid rgba(31,138,255,0.4)',
              borderRadius: 12, padding: '36px 28px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', textAlign: 'center',
            }}>
              <div style={{
                width: 120, height: 120, borderRadius: '50%',
                background: 'rgba(31,138,255,0.18)',
                border: `2px solid ${tokens.accent}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 24, overflow: 'hidden',
              }}>
                {iconUrl
                  ? <Img src={iconUrl} style={{ width: '60%', height: '60%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 56, color: '#fff' }}>◆</span>
                }
              </div>
              <div style={{
                fontSize: 32, fontWeight: 700, color: '#fff', marginBottom: 10,
                ...textStyle(seg.textStyles, `col.${i}.heading`),
              }}>
                {col.heading || ''}
              </div>
              {col.body && (
                <div style={{
                  fontSize: 20, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4,
                  ...textStyle(seg.textStyles, `col.${i}.body`),
                }}>
                  {col.body}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ════════════════════════════════════════
// KEY GOALS SLIDE
// ════════════════════════════════════════
export const KeyGoalsSlide: React.FC<{ seg: KeyGoalsSegment }> = ({ seg }) => {
  return (
    <div style={{
      ...slideBase,
      background: 'linear-gradient(135deg, #052A4E, #1A4D80)',
      alignItems: 'flex-start', justifyContent: 'center',
      padding: '80px 140px',
    }}>
      <div style={{
        fontSize: 80, fontWeight: 700, color: '#fff', marginBottom: 64,
        ...textStyle(seg.textStyles, 'title'),
      }}>
        {seg.title || 'Key Goals'}
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 32, width: '100%',
      }}>
        {(seg.bullets || []).map((b, i) => (
          <div key={b.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 24,
            fontSize: 36, color: '#fff', lineHeight: 1.3,
          }}>
            <div style={{
              width: 56, height: 56, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Img src={ASSETS.keyGoalIcon} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{
              flex: 1, paddingTop: 8,
              ...textStyle(seg.textStyles, `bullet.${i}.text`),
            }}>
              {b.text || ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ════════════════════════════════════════
// EMPTY SLIDE
// ════════════════════════════════════════
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
    case 'slide-journey': return <JourneySlide seg={seg} />;
    case 'slide-focus': return <FocusSlide seg={seg} />;
    case 'slide-keygoals': return <KeyGoalsSlide seg={seg} />;
    case 'slide-empty': return <EmptySlide seg={seg} />;
    default: return <EmptySlide seg={seg as EmptySegment} />;
  }
};
