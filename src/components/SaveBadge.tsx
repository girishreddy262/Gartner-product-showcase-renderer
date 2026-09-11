import React, { useEffect, useState } from 'react';
import { onSave, getSaveStatus, save, resolveKeepMine, resolveTakeTheirs, type SaveState } from '../store/persist';
import { useStore } from '../store/project';

/**
 * Three words for "your work is safe or it isn't" was two too many. Anything
 * in flight reads as Saving; only a real failure gets a different word.
 */
const LABEL: Record<SaveState, string> = {
  idle: '', dirty: 'Saving', saving: 'Saving', saved: 'Saved',
  offline: 'On this device', conflict: 'Conflict', error: 'Not saved',
};

export const SaveBadge: React.FC = () => {
  const [s, setS] = useState(getSaveStatus());
  const id = useStore((st) => st.project.id);
  useEffect(() => onSave(setS), []);

  if (s.state === 'conflict') {
    return (
      <div className="save-conflict" role="alert">
        <span>Someone else saved a newer version.</span>
        <button className="act" onClick={() => resolveTakeTheirs(id)}>Use theirs</button>
        <button className="act" onClick={() => resolveKeepMine()}>Keep mine</button>
      </div>
    );
  }

  if (!s.state || s.state === 'idle') return null;
  const bad = s.state === 'error' || s.state === 'offline';

  return (
    <button
      className="save-badge" data-state={s.state}
      onClick={() => save(true)}
      title={s.message || 'Click to save now'}
      aria-label={s.message ? `${LABEL[s.state]}: ${s.message}` : LABEL[s.state]}
    >
      <span className="save-dot" data-bad={bad} />
      {LABEL[s.state]}
    </button>
  );
};
