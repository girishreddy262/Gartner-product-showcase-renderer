import React, { useLayoutEffect, useRef, useState } from 'react';
import { useStore, patchItem, select, pushHistory } from '../store/project';
import { CANVAS_W, CANVAS_H } from '../store/types';
import type { LaneKey } from '../store/types';
import { Icon } from './Icon';
import { fmtPrecise } from '../lib/time';
import { projectDurationMs } from '../store/validate';
import { setPlaying, seek } from '../store/project';
import { Stage } from './Stage';
import { useUI, setPreviewZoom, fitPreview, toggleFullscreen } from '../store/ui';
import { clipPathFor } from '../lib/shapes';
import type { Shape } from '../store/types';

interface Box { id: string; lane: LaneKey; x: number; y: number; w: number; h: number; node: React.ReactNode; }

/**
 * The canvas is ALWAYS mounted. Media is optional. This is the fix for the
 * old editor, where overlays only existed once a clip sat under the playhead.
 */
export const Viewer: React.FC = () => {
  const p = useStore((s) => s.project);
  const ms = useStore((s) => s.playheadMs);
  const playing = useStore((s) => s.playing);
  const sel = useStore((s) => s.selection);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 360 });
  /** Where the pointer was when zooming, so the frame grows around the cursor. */
  const [origin, setOrigin] = useState({ x: 0.5, y: 0.5 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const scale = Math.min(r.width / CANVAS_W, r.height / CANVAS_H);
      setSize({ w: Math.max(80, CANVAS_W * scale), h: Math.max(45, CANVAS_H * scale) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoom = useUI((s) => s.previewZoom);
  const fullscreen = useUI((s) => s.fullscreen);
  const k = size.w / CANVAS_W;

  /* Ctrl or Cmd + wheel, and trackpad pinch, zoom the preview around the
     cursor. preventDefault stops the browser zooming the whole page. */
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setOrigin({
        x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
        y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      });
      setPreviewZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom]);
  const active = <T extends { startMs: number; durationMs: number }>(arr: T[]) =>
    arr.filter((i) => ms >= i.startMs && ms < i.startMs + i.durationMs);

  const boxes: Box[] = [
    ...active(p.shapes).map((s: Shape) => ({
      id: s.id, lane: 'shapes' as LaneKey, x: s.x, y: s.y, w: s.width, h: s.height,
      node: (
        <div style={{
          width: '100%', height: '100%',
          background: s.fill,
          opacity: s.opacity ?? 1,
          transform: s.rotation ? `rotate(${s.rotation}deg)` : undefined,
          borderRadius: s.kind === 'ellipse' ? '50%' : s.kind === 'roundedRect' ? s.radius * k : 0,
          clipPath: clipPathFor(s.kind, s.sides, s.innerRatio),
          border: s.strokeWidth ? `${Math.max(1, s.strokeWidth * k)}px solid ${s.stroke}` : undefined,
        }} />
      ),
    })),
    ...active(p.callouts).map((c) => ({
      id: c.id, lane: 'callouts' as LaneKey, x: c.x, y: c.y, w: 360, h: 72,
      node: (
        <div style={{
          background: '#ecedef', color: '#0a0b0d', borderRadius: 999 * k,
          padding: `${14 * k}px ${28 * k}px`, fontSize: 28 * k, whiteSpace: 'nowrap',
          display: 'inline-block',
        }}>{c.text}</div>
      ),
    })),
    ...active(p.textOverlays).map((t) => ({
      id: t.id, lane: 'textOverlays' as LaneKey, x: t.x, y: t.y, w: 480, h: 80,
      node: <div style={{ color: t.color, fontSize: t.fontSize * k, whiteSpace: 'nowrap' }}>{t.text}</div>,
    })),
  ];

  const drag = (b: Box) => (e: React.PointerEvent) => {
    e.stopPropagation();
    select(b.lane, b.id);
    pushHistory();
    const sx = e.clientX, sy = e.clientY, ox = b.x, oy = b.y;
    const move = (ev: PointerEvent) => {
      patchItem(b.lane, b.id, { x: ox + (ev.clientX - sx) / k, y: oy + (ev.clientY - sy) / k }, { history: false });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const total = projectDurationMs(p);

  return (
    <div className="col" style={{ flex: 1, minHeight: 0 }}>
      <div className={fullscreen ? 'stage stage-full' : 'stage'} ref={wrapRef}>
        <div className="preview-hud">
          <button className="hud-btn mono" onClick={fitPreview} aria-label="Reset preview zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button className="hud-btn" onClick={toggleFullscreen} aria-label="Fullscreen preview">
            <Icon n="fullscreen" s={13} />
          </button>
        </div>
        <div
          className="canvas-wrap"
          style={{
            width: size.w,
            height: size.h,
            background: p.background.value,
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: `${origin.x * 100}% ${origin.y * 100}%`,
          }}
        >
          <Stage />
          <div className="olayer">
            {boxes.map((b) => (
              <div
                key={b.id}
                className="ovi"
                data-sel={sel.id === b.id}
                style={{
                  left: b.x * k,
                  top: b.y * k,
                  width: b.lane === 'shapes' ? b.w * k : undefined,
                  height: b.lane === 'shapes' ? b.h * k : undefined,
                }}
                onPointerDown={drag(b)}
              >
                {b.node}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="transport">
        <button className="icon-btn" aria-label="Previous" onClick={() => seek(0)}><Icon n="prev" /></button>
        <button className="play" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}>
          <Icon n={playing ? 'pause' : 'play'} s={14} />
        </button>
        <button className="icon-btn" aria-label="Next" onClick={() => seek(total)}><Icon n="next" /></button>
        <span className="mono" style={{ fontSize: 11 }}>{fmtPrecise(ms)}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>/ {fmtPrecise(total)}</span>
      </div>
    </div>
  );
};
