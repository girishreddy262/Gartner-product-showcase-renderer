import React from 'react';
import { useStore } from '../../store/project';
import { fmt } from '../../lib/time';

/**
 * Music and sound effects. Narration settings deliberately do NOT live here:
 * they belong beside the script they change, which is the transcript.
 */
export const MusicPanel: React.FC = () => {
  const music = useStore((s) => s.project.music);
  return (
    <div className="panel-body">
      <button className="import-btn" aria-label="Add music">Add music</button>
      {!music.length
        ? <p className="hint">Background music and sound effects go here. Narration is generated from the transcript, and its voice settings live there.</p>
        : (
          <ul className="media-list">
            {music.map((m) => (
              <li key={m.id}>
                <span className="media-meta">
                  <span className="media-name">{m.label}</span>
                  <span className="media-sub">{fmt(m.durationMs)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
};
