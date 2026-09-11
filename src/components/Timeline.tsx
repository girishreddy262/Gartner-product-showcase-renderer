import React, { useLayoutEffect, useRef, useState } from 'react';
import { useStore, patchItem, select, seek, setZoom, pushHistory, undo, redo } from '../store/project';
import { projectDurationMs, snap } from '../store/validate';
import type { LaneKey, TimedBase, Segment } from '../store/types';
import { MIN_DURATION_MS } from '../store/types';
import { Icon } from './Icon';
import { fmt } from '../lib/time';

/**
 * The transcript owns one clip per paragraph so that deleting words can cut the
 * matching footage. Drawing forty of those makes a video look chopped to
 * pieces when nothing was actually cut.
 *
 * So runs that are CONTINUOUS in the source are drawn as a single clip. Where
 * the footage really does jump, because words were removed, the break shows,
 * which is the only place a break should show.
 */
function visualClips(lane: LaneKey, items: TimedBase[]): TimedBase[] {
  if (lane !== 'segments') return items;
  const segs = [...(items as unknown as Segment[])].sort((a, b) => a.startMs - b.startMs);
  const out: Segment[] = [];

  for (const s of segs) {
    const last = out[out.length - 1];
    // Word timings never abut perfectly, so a small mismatch at a paragraph
    // boundary is rounding, not an edit. A removed word leaves a gap of at
    // least its own length, which is far larger than this.
    const SLOP = 150;
    const joins = last
      && last.videoId === s.videoId
      && !last.holdTailMs
      && Math.abs(last.startMs + last.durationMs - s.startMs) < SLOP
      && Math.abs((last.sourceStartMs + last.durationMs) - s.sourceStartMs) < SLOP;

    if (joins) out[out.length - 1] = { ...last, durationMs: last.durationMs + s.durationMs };
    else out.push({ ...s });
  }
  return out as unknown as TimedBase[];
}

const LANES: { key: LaneKey; label: string; color: string; border: string }[] = [
  { key: 'segments', label: 'Screen', color: '#233247', border: '#2e4257' },
  { key: 'camera', label: 'Camera', color: '#2b3a33', border: '#3c5147' },
  { key: 'voice', label: 'Voice', color: '#2e2b41', border: '#403a58' },
  { key: 'music', label: 'Music', color: '#3a3122', border: '#55452b' },
  { key: 'callouts', label: 'Callouts', color: '#3e3324', border: '#55452b' },
  { key: 'textOverlays', label: 'Text', color: '#2b3a33', border: '#3c5147' },
  { key: 'shapes', label: 'Shapes', color: '#2e2b41', border: '#3b3854' },
];

type Tool = 'select' | 'blade' | 'hand';

export const Timeline: React.FC<{ onRecord?: () => void }> = ({ onRecord }) => {
  const p = useStore((s) => s.project);
  const ms = useStore((s) => s.playheadMs);
  const pxPerMs = useStore((s) => s.pxPerMs);
  const sel = useStore((s) => s.selection);
  const [tool, setTool] = useState<Tool>('select');
  const [snapOn, setSnapOn] = useState(true);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const trackRef = useRef<HTMLDivElement>(null);

  const total = projectDurationMs(p);
  const width = Math.max(600, total * pxPerMs);
  const toMs = (px: number) => px / pxPerMs;
  const toPx = (v: number) => v * pxPerMs;

  /** Edges of every other item, plus the playhead, for snapping. */
  const snapPoints = (excludeId: string): number[] => {
    const pts: number[] = [0, total, ms];
    for (const l of LANES) {
      for (const it of p[l.key] as unknown as TimedBase[]) {
        if (it.id === excludeId) continue;
        pts.push(it.startMs, it.startMs + it.durationMs);
      }
    }
    return pts;
  };

  /* Ctrl or Cmd + wheel, and trackpad pinch, zoom the timeline around the
     cursor so the frame under the pointer stays put. */
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchorPx = e.clientX - rect.left + el.scrollLeft;
      const anchorMs = anchorPx / pxPerMs;
      const next = pxPerMs * (e.deltaY < 0 ? 1.15 : 1 / 1.15);
      setZoom(next);
      requestAnimationFrame(() => {
        const after = anchorMs * (el.dataset.ppm ? Number(el.dataset.ppm) : next);
        el.scrollLeft = after - (e.clientX - rect.left);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [pxPerMs]);

  const scrub = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const go = (clientX: number) => seek(toMs(clientX - rect.left + el.scrollLeft));
    go(e.clientX);
    const move = (ev: PointerEvent) => go(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startDrag = (lane: LaneKey, item: TimedBase, mode: 'move' | 'l' | 'r') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    select(lane, item.id);
    if (tool === 'blade') {
      // Blade splits at the playhead when it falls inside the clip.
      if (ms > item.startMs + MIN_DURATION_MS && ms < item.startMs + item.durationMs - MIN_DURATION_MS) {
        patchItem(lane, item.id, { durationMs: ms - item.startMs });
      }
      return;
    }
    pushHistory();
    const sx = e.clientX;
    const start0 = item.startMs;
    const dur0 = item.durationMs;
    const pts = snapPoints(item.id);
    const tol = 8 / pxPerMs;

    const move = (ev: PointerEvent) => {
      const dMs = toMs(ev.clientX - sx);
      if (mode === 'move') {
        let s = start0 + dMs;
        if (snapOn) s = snap(s, pts, tol);
        patchItem(lane, item.id, { startMs: s }, { history: false });
      } else if (mode === 'r') {
        let end = start0 + dur0 + dMs;
        if (snapOn) end = snap(end, pts, tol);
        patchItem(lane, item.id, { durationMs: Math.max(MIN_DURATION_MS, end - start0) }, { history: false });
      } else {
        let s = start0 + dMs;
        if (snapOn) s = snap(s, pts, tol);
        s = Math.min(s, start0 + dur0 - MIN_DURATION_MS);
        patchItem(lane, item.id, { startMs: s, durationMs: start0 + dur0 - s }, { history: false });
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = mode === 'move' ? 'grabbing' : 'ew-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const step = Math.max(1000, Math.round(total / 8 / 1000) * 1000);
  const ticks: number[] = [];
  for (let t = 0; t <= total; t += step) ticks.push(t);

  return (
    <div className="tl">
      <div className="tl-tools">
        <button className="icon-btn" aria-label="Undo" disabled={!canUndo} onClick={undo}><Icon n="undo" /></button>
        <button className="icon-btn" aria-label="Redo" disabled={!canRedo} onClick={redo}><Icon n="redo" /></button>
        <span className="sep" />
        <button className="icon-btn" aria-label="Record" style={{ color: 'var(--danger)' }} onClick={onRecord}><Icon n="record" /></button>
        <span className="sep" />
        <button className="icon-btn" data-on={tool === 'select'} aria-label="Select tool" onClick={() => setTool('select')}><Icon n="pointer" /></button>
        <button className="icon-btn" data-on={tool === 'blade'} aria-label="Blade tool" onClick={() => setTool('blade')}><Icon n="blade" /></button>
        <button className="icon-btn" data-on={tool === 'hand'} aria-label="Hand tool" onClick={() => setTool('hand')}><Icon n="hand" /></button>
        <span className="sep" />
        <button className="icon-btn" data-on={snapOn} aria-label="Snapping" onClick={() => setSnapOn(!snapOn)}><Icon n="magnet" /></button>
        <button className="icon-btn" aria-label="Add marker"><Icon n="flag" /></button>
        <span className="spacer" />
        <button className="icon-btn" aria-label="Zoom out timeline" onClick={() => setZoom(pxPerMs / 1.4)}><Icon n="zout" /></button>
        <button className="zoom-pct mono" onClick={() => setZoom(0.06)} aria-label="Reset timeline zoom">
          {Math.round((pxPerMs / 0.06) * 100)}%
        </button>
        <button className="icon-btn" aria-label="Zoom in timeline" onClick={() => setZoom(pxPerMs * 1.4)}><Icon n="zin" /></button>
      </div>

      <div className="tl-grid">
        <div className="tl-gutter">
          {LANES.map((l) => <div key={l.key}>{l.label}</div>)}
        </div>

        <div className="tl-track" ref={trackRef}>
          {/* minWidth keeps the lanes filling the row when the project is
              shorter than the visible width, so a short video does not leave
              stub tracks floating in empty space. */}
          <div style={{ width, minWidth: '100%', position: 'relative' }}>
            <div className="tl-ruler" onPointerDown={scrub}>
              {ticks.map((t) => (
                <span key={t} className="tl-tick" style={{ left: toPx(t) + 2 }}>{fmt(t)}</span>
              ))}
            </div>

            <div className="playhead" style={{ left: toPx(ms) }} />
            <div className="playhead-chip mono" style={{ left: toPx(ms) }}>{fmt(ms)}</div>

            {LANES.map((l) => (
              <div className="tl-lane" key={l.key}>
                <div className="tl-lane-bg" />
                {visualClips(l.key, p[l.key] as unknown as TimedBase[]).map((it) => (
                  <div
                    key={it.id}
                    className="clip"
                    data-sel={sel.id === it.id}
                    style={{
                      left: toPx(it.startMs),
                      width: Math.max(10, toPx(it.durationMs)),
                      background: l.color,
                      border: `1px solid ${l.border}`,
                    }}
                    onPointerDown={startDrag(l.key, it, 'move')}
                  >
                    <div className="grip grip-l" onPointerDown={startDrag(l.key, it, 'l')} />
                    <div className="clip-label">{(it as unknown as { text?: string }).text || l.label}</div>
                    <div className="grip grip-r" onPointerDown={startDrag(l.key, it, 'r')} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
