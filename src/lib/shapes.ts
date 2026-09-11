import type { ShapeKind } from '../store/types';

/** CSS clip-path for the shapes that cannot be drawn with border-radius. */
export function clipPathFor(kind: ShapeKind, sides: number, innerRatio: number): string | undefined {
  if (kind === 'rect' || kind === 'roundedRect' || kind === 'ellipse') return undefined;

  const pts: string[] = [];
  if (kind === 'polygon') {
    const n = Math.max(3, Math.min(12, sides));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      pts.push(`${(50 + 50 * Math.cos(a)).toFixed(2)}% ${(50 + 50 * Math.sin(a)).toFixed(2)}%`);
    }
  } else {
    const n = Math.max(3, Math.min(12, sides));
    const r = Math.max(0.1, Math.min(0.9, innerRatio));
    for (let i = 0; i < n * 2; i++) {
      const rad = i % 2 === 0 ? 50 : 50 * r;
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      pts.push(`${(50 + rad * Math.cos(a)).toFixed(2)}% ${(50 + rad * Math.sin(a)).toFixed(2)}%`);
    }
  }
  return `polygon(${pts.join(', ')})`;
}

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rect: 'Rectangle',
  roundedRect: 'Rounded rectangle',
  ellipse: 'Ellipse',
  polygon: 'Polygon',
  star: 'Star',
};
