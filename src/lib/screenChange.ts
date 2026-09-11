/**
 * Finds moments where the screen genuinely changed.
 *
 * No model is involved: this is pixel arithmetic. Decode frames, compare each
 * to the last, and report where a lot of the picture moved. A dialog opening or
 * a page navigating shows up clearly; a cursor drifting does not. Doing it
 * locally also means nothing is uploaded and nothing is billed.
 */

export interface ScreenEvent {
  atMs: number;
  /** 0..1, how much of the frame changed. */
  amount: number;
  /** Centre of the change, as a fraction of the frame. */
  x: number;
  y: number;
}

const GRID = 12;          // sample the frame as a coarse grid
const STEP_MS = 500;      // half a second is enough to catch a screen change
const CHANGED = 0.14;     // a cell counts as changed above this difference
const EVENT = 0.16;       // and the frame is an event above this share of cells

/** Scan a video for moments worth looking at. */
export async function findScreenEvents(
  src: string,
  opts: { maxMs?: number; onProgress?: (p: number) => void } = {}
): Promise<ScreenEvent[]> {
  const v = document.createElement('video');
  v.src = src;
  v.muted = true;
  v.crossOrigin = 'anonymous';

  await new Promise<void>((res, rej) => {
    v.onloadedmetadata = () => res();
    v.onerror = () => rej(new Error('could not read that video'));
  });

  const durMs = Math.min(opts.maxMs ?? Infinity, (v.duration || 0) * 1000);
  if (!durMs) return [];

  const c = document.createElement('canvas');
  c.width = GRID;
  c.height = GRID;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  const events: ScreenEvent[] = [];
  let prev: Uint8ClampedArray | null = null;

  for (let t = 0; t < durMs; t += STEP_MS) {
    await seekTo(v, t / 1000);
    ctx.drawImage(v, 0, 0, GRID, GRID);
    const now = ctx.getImageData(0, 0, GRID, GRID).data;

    if (prev) {
      let changed = 0;
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < GRID * GRID; i++) {
        const o = i * 4;
        // Luma is enough, and it ignores colour-only shifts like a theme change.
        const a = (prev[o] * 0.299 + prev[o + 1] * 0.587 + prev[o + 2] * 0.114) / 255;
        const b = (now[o] * 0.299 + now[o + 1] * 0.587 + now[o + 2] * 0.114) / 255;
        if (Math.abs(a - b) > CHANGED) {
          changed++;
          sx += (i % GRID) / GRID;
          sy += Math.floor(i / GRID) / GRID;
        }
      }
      const share = changed / (GRID * GRID);
      if (share > EVENT) {
        events.push({ atMs: t, amount: share, x: sx / changed, y: sy / changed });
      }
    }

    prev = now;
    opts.onProgress?.(t / durMs);
  }

  v.src = '';
  return merge(events);
}

function seekTo(v: HTMLVideoElement, s: number) {
  return new Promise<void>((res) => {
    const done = () => { v.removeEventListener('seeked', done); res(); };
    v.addEventListener('seeked', done);
    v.currentTime = s;
  });
}

/** A transition spans several frames; report it once, at its strongest point. */
function merge(evts: ScreenEvent[], withinMs = 1200): ScreenEvent[] {
  const out: ScreenEvent[] = [];
  for (const e of evts) {
    const last = out[out.length - 1];
    if (last && e.atMs - last.atMs < withinMs) {
      if (e.amount > last.amount) out[out.length - 1] = e;
    } else out.push(e);
  }
  return out;
}
