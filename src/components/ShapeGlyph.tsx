import React from 'react';
import type { ShapeKind } from '../store/types';
import { clipPathFor } from '../lib/shapes';

/** Small outline mark used in the shape list and the type dropdown. */
export const ShapeGlyph: React.FC<{ kind: ShapeKind; size?: number }> = ({ kind, size = 13 }) => {
  const base: React.CSSProperties = { width: size, height: size, flex: 'none', display: 'block' };
  if (kind === 'rect') return <span style={{ ...base, height: size - 2, border: '1.2px solid currentColor', borderRadius: 1 }} />;
  if (kind === 'roundedRect') return <span style={{ ...base, height: size - 2, border: '1.2px solid currentColor', borderRadius: 4 }} />;
  if (kind === 'ellipse') return <span style={{ ...base, border: '1.2px solid currentColor', borderRadius: 999 }} />;
  return <span style={{ ...base, background: 'currentColor', clipPath: clipPathFor(kind, kind === 'star' ? 5 : 5, 0.45) }} />;
};
