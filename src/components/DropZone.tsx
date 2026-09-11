import React, { useEffect, useState } from 'react';
import { importFiles } from '../store/media';

/** Drop anywhere in the editor. Counting enter/leave avoids the flicker that
 *  happens when the pointer crosses a child element. */
export const DropZone: React.FC = () => {
  const [over, setOver] = useState(0);

  useEffect(() => {
    const enter = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); setOver((n) => n + 1); } };
    const leave = (e: DragEvent) => { e.preventDefault(); setOver((n) => Math.max(0, n - 1)); };
    const over_ = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setOver(0);
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) importFiles(files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over_);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over_);
      window.removeEventListener('drop', drop);
    };
  }, []);

  if (!over) return null;
  return <div className="drop"><div>Drop to import</div></div>;
};
