import React, { useRef, useState } from 'react';

/**
 * An explanation attached to an info dot.
 *
 * The browser's own title attribute takes a second to appear, cannot be
 * styled, and never shows on keyboard focus. This is drawn by us: it appears
 * at once, matches the app, and flips below or shifts sideways rather than
 * running off the panel.
 */
export const Tip: React.FC<{ text: string; label?: string }> = ({ text, label = 'More about this' }) => {
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const dot = useRef<HTMLButtonElement>(null);

  const show = () => {
    const r = dot.current?.getBoundingClientRect();
    if (!r) return;
    // Prefer above. Below only when there is genuinely no room up there.
    const below = r.top < 90;
    setPos({ x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
  };

  return (
    <>
      <button
        ref={dot}
        type="button"
        className="tip-dot"
        aria-label={label}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        onFocus={show}
        onBlur={() => setPos(null)}
        onClick={(e) => { e.preventDefault(); pos ? setPos(null) : show(); }}
      >i</button>

      {pos && (
        <span
          role="tooltip"
          className={pos.below ? 'tip tip-below' : 'tip'}
          style={{ left: pos.x, top: pos.y }}
        >
          {text}
          <span className="tip-arrow" />
        </span>
      )}
    </>
  );
};
