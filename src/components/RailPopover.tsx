import React, { useEffect, useRef } from 'react';

/**
 * Small popover anchored to a rail button, the way Clueso shows its shape
 * picker. Used for short pick-one lists that would waste a full column.
 * Closes on select, Escape, or a click outside.
 */
export const RailPopover: React.FC<{
  anchorY: number;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ anchorY, title, onClose, children }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // defer so the opening click does not immediately close it
    const t = setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const top = Math.min(anchorY, window.innerHeight - 260);

  return (
    <div className="pop" ref={ref} style={{ top }} role="dialog" aria-label={title}>
      {children}
    </div>
  );
};
