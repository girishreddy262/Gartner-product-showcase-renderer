import React from 'react';
import { Tip } from './Tip';

/**
 * Fish's slider: the ROW is the track. A filled portion runs left to right,
 * the label sits inside on the left and the value inside on the right. The
 * range input is kept underneath at zero opacity so keyboard and screen reader
 * behaviour still work.
 */
export const Slider: React.FC<{
  label: string; value: number; min: number; max: number; step?: number;
  format?: (v: number) => string; onChange: (v: number) => void;
  /** Optional one-line explanation, shown behind an info dot. */
  hint?: string;
}> = ({ label, value, min, max, step = 1, format, onChange, hint }) => {
  const t = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
  const TICKS = 11;
  // Which tick the handle currently sits on, so the row reads as a scale
  // rather than a bar that happens to be part filled.
  const on = Math.round(t * (TICKS - 1));

  return (
    <div className="row row-slider">
      <span className="row-label">
        {label}
        {hint && <Tip text={hint} label={`About ${label}`} />}
      </span>

      <span className="ticks" aria-hidden="true">
        {Array.from({ length: TICKS }, (_, i) => (
          <span key={i} className={i === on ? 'tick tick-on' : 'tick'} />
        ))}
      </span>

      <span className="row-val mono">{format ? format(value) : Math.round(value)}</span>

      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} aria-label={label}
      />
    </div>
  );
};

/** Exact value: plain field. Coordinates are typed, not dragged. */
export const NumField: React.FC<{
  label: string; value: number; step?: number; onChange: (v: number) => void;
}> = ({ label, value, step = 1, onChange }) => (
  <label className="nf">
    <span>{label}</span>
    <input type="number" step={step} value={Math.round(value)} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
);

/** Labelled version is a filled row too, so it lines up with the sliders. */
/** A row whose control is a set of choices, laid out like the sliders above. */
export const ChoiceRow: React.FC<{
  label: string; value: string; options: { key: string; label: string }[];
  hint?: string; onChange: (v: string) => void;
}> = ({ label, value, options, hint, onChange }) => (
  // Three or more choices rarely share a line with a label in a narrow panel.
  <div className={options.length > 2 ? 'row row-choice-wrap' : 'row'}>
    <span className="row-label">
      {label}
      {hint && <Tip text={hint} label={`About ${label}`} />}
    </span>
    <span className="choices">
      {options.map((o) => (
        <button
          key={o.key}
          className={o.key === value ? 'choice on' : 'choice'}
          onClick={() => onChange(o.key)}
          aria-pressed={o.key === value}
        >{o.label}</button>
      ))}
    </span>
  </div>
);

export const Segmented: React.FC<{
  label?: string; value: string; options: { key: string; label: string }[];
  onChange: (k: string) => void; small?: boolean;
}> = ({ label, value, options, onChange, small }) => {
  if (!label) {
    return (
      <div className={small ? 'seg seg-sm' : 'seg'} role="group" aria-label="options">
        {options.map((o) => (
          <button key={o.key} data-on={value === o.key} onClick={() => onChange(o.key)}>{o.label}</button>
        ))}
      </div>
    );
  }
  return (
    <div className="frow">
      <span className="frow-label">{label}</span>
      <span className="spacer" />
      <div className="seg seg-sm" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.key} data-on={value === o.key} onClick={() => onChange(o.key)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
};

export const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="grp">
    <div className="grp-label">{title}</div>
    {children}
  </section>
);

export const Swatch: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="row-toggle">
    <span>{label}</span><span className="spacer" />
    <input type="color" className="swatch" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
  </div>
);

/**
 * Figma's fill row: swatch, hex, opacity, visibility. One line, editable in
 * place, rather than a colour well hidden behind a label.
 */
export const FillRow: React.FC<{
  value: string; opacity: number; visible?: boolean;
  onColor: (v: string) => void; onOpacity: (v: number) => void; onVisible?: (v: boolean) => void;
}> = ({ value, opacity, visible = true, onColor, onOpacity, onVisible }) => {
  const hex = value.replace('#', '').toUpperCase();
  return (
    <div className="fill-row">
      <label className="fill-swatch" aria-label="Colour">
        <input type="color" value={value} onChange={(e) => onColor(e.target.value)} />
        <span style={{ background: value }} />
      </label>
      <input
        className="fill-hex mono" value={hex} spellCheck={false} aria-label="Hex colour"
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
          if (v.length === 6) onColor('#' + v);
        }}
      />
      <span className="fill-op">
        <input
          className="mono" type="number" min={0} max={100} value={Math.round(opacity * 100)}
          onChange={(e) => onOpacity(Math.min(100, Math.max(0, Number(e.target.value))) / 100)}
          aria-label="Opacity"
        />
        <em>%</em>
      </span>
      {onVisible && (
        <button className="icon-btn" aria-label={visible ? 'Hide' : 'Show'} onClick={() => onVisible(!visible)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            {visible
              ? <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>
              : <><path d="M4 4l16 16" /><path d="M2 12s4-7 10-7c2 0 3.7.8 5.1 1.8M22 12s-4 7-10 7c-2 0-3.7-.8-5.1-1.8" /></>}
          </svg>
        </button>
      )}
    </div>
  );
};

/** Figma's section header: title, optional add button. */
export const SectionHead: React.FC<{ title: string; onAdd?: () => void; muted?: boolean }> = ({ title, onAdd, muted }) => (
  <div className="sec-head" data-muted={muted}>
    <span>{title}</span><span className="spacer" />
    {onAdd && <button className="icon-btn" aria-label={`Add ${title.toLowerCase()}`} onClick={onAdd}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 5v14M5 12h14" /></svg>
    </button>}
  </div>
);

/** Icon button group, e.g. text alignment. */
export const IconGroup: React.FC<{
  label: string; value: string; options: { key: string; label: string; path: string }[];
  onChange: (k: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="ig" role="group" aria-label={label}>
    {options.map((o) => (
      <button key={o.key} data-on={value === o.key} aria-label={o.label} title={o.label} onClick={() => onChange(o.key)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={o.path} /></svg>
      </button>
    ))}
  </div>
);

/** Labelled field with a unit suffix, Figma's compact number input. */
export const UnitField: React.FC<{
  label: string; value: number | string; unit?: string; step?: number;
  onChange: (v: string) => void;
}> = ({ label, value, unit, step = 1, onChange }) => (
  <label className="uf">
    <span className="uf-label">{label}</span>
    <span className="uf-box">
      <input type={typeof value === 'number' ? 'number' : 'text'} step={step} value={value}
        onChange={(e) => onChange(e.target.value)} aria-label={label} />
      {unit && <em>{unit}</em>}
    </span>
  </label>
);
