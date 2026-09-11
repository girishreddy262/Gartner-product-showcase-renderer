import React from 'react';
import { addItem } from '../../store/project';
import { SHAPE_DEFAULTS, type ShapeKind } from '../../store/types';
import { SHAPE_LABELS } from '../../lib/shapes';
import { itemId } from '../../lib/id';
import { ShapeGlyph } from '../ShapeGlyph';

const KINDS: ShapeKind[] = ['rect', 'roundedRect', 'ellipse', 'polygon', 'star'];

/** A compact list, not a grid of oversized tiles. Type is switchable afterwards
 *  from the inspector, so this panel exists only to insert. */
export const ShapesPanel: React.FC<{ onPick?: () => void }> = ({ onPick }) => {
  const add = (kind: ShapeKind) => {
    const d = SHAPE_DEFAULTS[kind];
    addItem('shapes', {
      id: itemId('sh'), kind, startMs: 0, durationMs: 3000,
      x: 960 - (d.width ?? 400) / 2, y: 540 - (d.height ?? 240) / 2,
      fill: '#0183ff', stroke: '#ffffff', strokeWidth: 0, opacity: 1, rotation: 0, ...d,
    });
    onPick?.();
  };
  return (
    <div>
      <ul className="list">
        {KINDS.map((k) => (
          <li key={k}>
            <button onClick={() => add(k)} aria-label={SHAPE_LABELS[k]}>
              <ShapeGlyph kind={k} />
              <span>{SHAPE_LABELS[k]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
