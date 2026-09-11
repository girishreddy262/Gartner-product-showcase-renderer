import React from 'react';
import { addItem } from '../../store/project';
import { itemId } from '../../lib/id';

export const TextPanel: React.FC = () => {
  const add = (fontSize: number, label: string) => {
    addItem('textOverlays', {
      id: itemId('tx'), startMs: 0, durationMs: 3000,
      x: 480, y: 480, text: label, fontSize, color: '#ffffff',
    });
  };
  return (
    <div className="panel-body">
      <button className="tile tile-wide" onClick={() => add(96, 'Heading')} aria-label="Add a heading">
        <span style={{ fontSize: 22 }}>Heading</span>
      </button>
      <button className="tile tile-wide" onClick={() => add(56, 'Subheading')} aria-label="Add a subheading">
        <span style={{ fontSize: 16 }}>Subheading</span>
      </button>
      <button className="tile tile-wide" onClick={() => add(34, 'Body text')} aria-label="Add body text">
        <span style={{ fontSize: 13 }}>Body text</span>
      </button>
    </div>
  );
};

export const EffectsPanel: React.FC = () => {
  const add = (type: 'zoom' | 'spotlight') => {
    addItem('effects', {
      id: itemId('fx'), startMs: 0, durationMs: 2000,
      type, x: 960, y: 540, scale: type === 'zoom' ? 1.4 : 1,
    });
  };
  return (
    <div className="panel-body">
      <button className="tile tile-wide" onClick={() => add('zoom')} aria-label="Add a zoom">Zoom 1.4x</button>
      <button className="tile tile-wide" onClick={() => add('spotlight')} aria-label="Add a spotlight">Spotlight</button>
    </div>
  );
};

export const TransitionsPanel: React.FC = () => (
  <div className="panel-body"><p className="hint">Transitions arrive once media import lands.</p></div>
);

export const AudioPanel: React.FC = () => (
  <div className="panel-body"><p className="hint">Music, sound effects and voice generation arrive with the audio phase.</p></div>
);
