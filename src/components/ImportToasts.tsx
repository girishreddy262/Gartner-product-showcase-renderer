import React, { useEffect, useState } from 'react';
import { onImports, getImports, type ImportState } from '../store/media';

export const ImportToasts: React.FC = () => {
  const [items, setItems] = useState<ImportState[]>(getImports());
  useEffect(() => onImports(setItems), []);
  if (!items.length) return null;
  return (
    <div className="imports" role="status" aria-live="polite">
      {items.map((it, i) => (
        <div className="imp-row" key={i}>
          <span className="imp-name">{it.name}</span>
          {it.error
            ? <span className="imp-err">{it.error}</span>
            : it.stage
              ? <span className="imp-stage">{it.stage}</span>
              : <span className="imp-bar"><i style={{ width: `${Math.round(it.pct * 100)}%` }} /></span>}
        </div>
      ))}
    </div>
  );
};
