import React, { useCallback } from 'react';

/** Draggable divider. Every panel boundary gets one. */
export const Splitter: React.FC<{
  dir?: 'v' | 'h';
  onDelta: (px: number) => void;
  onReset?: () => void;
}> = ({ dir = 'v', onDelta, onReset }) => {
  const down = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const start = dir === 'v' ? e.clientX : e.clientY;
    let last = start;
    const move = (ev: PointerEvent) => {
      const now = dir === 'v' ? ev.clientX : ev.clientY;
      onDelta(now - last);
      last = now;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = dir === 'v' ? 'col-resize' : 'row-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [dir, onDelta]);

  return (
    <div
      className={dir === 'v' ? 'splitter' : 'splitter-h'}
      onPointerDown={down}
      onDoubleClick={onReset}
      role="separator"
      aria-orientation={dir === 'v' ? 'vertical' : 'horizontal'}
    >
      <i />
    </div>
  );
};
