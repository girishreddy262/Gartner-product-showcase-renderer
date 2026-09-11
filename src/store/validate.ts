import { MIN_DURATION_MS, CANVAS_W, CANVAS_H, type Project, type TimedBase } from './types';
import { clamp } from '../lib/time';

/** An empty project still needs a usable stretch of time to work in. */
export const EMPTY_TIMELINE_MS = 30000;

/**
 * Longest point on the timeline. Media and script drive it, but overlay items
 * count too, otherwise an empty project would have a 100ms timeline and every
 * clamp would crush items on top of each other.
 */
export function projectDurationMs(p: Project): number {
  let max = 0;
  for (const s of p.segments) max = Math.max(max, s.startMs + s.durationMs);
  for (const s of p.camera) max = Math.max(max, s.startMs + s.durationMs);
  for (const lane of [p.voice, p.music]) for (const a of lane) max = Math.max(max, a.startMs + a.durationMs);
  for (const lane of [p.callouts, p.textOverlays, p.shapes, p.effects]) {
    for (const i of lane) max = Math.max(max, i.startMs + i.durationMs);
  }
  let blockEnd = 0;
  for (const b of p.blocks) blockEnd += b.durationMs;
  const hasMedia = p.segments.length > 0 || p.camera.length > 0 || p.blocks.length > 0;
  return Math.max(max, blockEnd, hasMedia ? MIN_DURATION_MS : EMPTY_TIMELINE_MS);
}

/**
 * Force a timed item into legal bounds. Called on EVERY write, which is why
 * negative starts, zero durations and past-the-end placement cannot be stored.
 */
export function clampTimed<T extends TimedBase>(item: T, projectMs: number): T {
  const rawDur = Number.isFinite(item.durationMs) ? item.durationMs : MIN_DURATION_MS;
  const dur = Math.max(MIN_DURATION_MS, Math.round(rawDur));
  const maxStart = Math.max(0, projectMs - MIN_DURATION_MS);
  const rawStart = Number.isFinite(item.startMs) ? item.startMs : 0;
  const start = clamp(Math.round(rawStart), 0, maxStart);
  const cappedDur = Math.min(dur, Math.max(MIN_DURATION_MS, projectMs - start));
  return { ...item, startMs: start, durationMs: cappedDur };
}

/** Keep positions on the canvas so nothing can be dragged into nowhere. */
export function clampPoint(x: number, y: number) {
  return { x: clamp(Math.round(x), 0, CANVAS_W), y: clamp(Math.round(y), 0, CANVAS_H) };
}

export function clampSize(w: number, h: number) {
  return { width: clamp(Math.round(w), 8, CANVAS_W), height: clamp(Math.round(h), 8, CANVAS_H) };
}

/** Ids must be unique inside a lane, else select and delete hit the wrong item. */
export function ensureUniqueId(existing: { id: string }[], id: string): boolean {
  return !existing.some((x) => x.id === id);
}

/** True when two items overlap in time. */
export function overlaps(a: TimedBase, b: TimedBase): boolean {
  return a.startMs < b.startMs + b.durationMs && b.startMs < a.startMs + a.durationMs;
}

/**
 * Slide an item to the nearest free gap in its lane, so a lane never holds two
 * items on top of each other. Returns the adjusted start.
 */
export function resolveOverlap(item: TimedBase, lane: TimedBase[], projectMs: number): number {
  const others = lane
    .filter((o) => o.id !== item.id)
    .sort((a, b) => a.startMs - b.startMs);
  let start = item.startMs;
  const dur = item.durationMs;
  for (const o of others) {
    if (start < o.startMs + o.durationMs && o.startMs < start + dur) {
      start = o.startMs + o.durationMs;
    }
  }
  return clamp(start, 0, Math.max(0, projectMs - dur));
}

/** Snap a millisecond value to nearby item edges and to the playhead. */
export function snap(ms: number, candidates: number[], toleranceMs: number): number {
  let best = ms;
  let bestDist = toleranceMs;
  for (const c of candidates) {
    const d = Math.abs(c - ms);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}
