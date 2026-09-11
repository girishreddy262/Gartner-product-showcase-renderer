import { getState, update } from './project';
import { itemId } from '../lib/id';
import type { Project, Block, SyncPoint } from './types';

/**
 * Sync points keep the script matched to the screen.
 *
 * An AI voice is never the same length as the speech it replaces. Regenerate
 * forty paragraphs and, without pins, the narration ends up describing a screen
 * from half a minute ago. A pin says "this word lands at this frame", and the
 * footage between two pins is stretched or held to make that true.
 */

/** Don't pin every sentence: a pin every few seconds is enough to stop drift
 *  without turning the script into a field of chips. */
const EVERY_MS = 6000;
const MIN_WORDS = 6;

/** Sentence ends are the natural place to pin, since a held frame there reads
 *  as a beat rather than a stutter. */
const ENDS = /[.!?]$/;

export function pointsFor(p: Project, blockId: string) {
  return p.syncPoints.filter((s) => s.blockId === blockId).sort((a, b) => a.wordIndex - b.wordIndex);
}

/** Place pins across a block at sentence ends, roughly every few seconds. */
export function autoPin(block: Block): SyncPoint[] {
  const ws = block.words || [];
  if (ws.length < MIN_WORDS) return [];
  const out: SyncPoint[] = [];
  let lastAt = 0;
  ws.forEach((w, i) => {
    if (i === 0 || i === ws.length - 1) return;
    if (w.startMs - lastAt < EVERY_MS) return;
    if (!ENDS.test(w.text)) return;
    out.push({ id: itemId('sp'), blockId: block.id, wordIndex: i + 1, sourceMs: ws[i + 1]?.startMs ?? w.endMs });
    lastAt = w.startMs;
  });
  return out;
}

/** Lay pins across the whole project, leaving any the user moved. */
export function autoPinProject() {
  update((p) => {
    const kept = p.syncPoints.filter((s) => s.manual);
    const made = p.blocks.flatMap((b) => (b.words?.length ? autoPin(b) : []))
      .filter((s) => !kept.some((k) => k.blockId === s.blockId && Math.abs(k.wordIndex - s.wordIndex) < 3));
    p.syncPoints = [...kept, ...made];
    return p;
  });
  return getState().project.syncPoints.length;
}

export function addPin(blockId: string, wordIndex: number) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    const w = b?.words?.[wordIndex];
    if (!w) return p;
    if (p.syncPoints.some((s) => s.blockId === blockId && s.wordIndex === wordIndex)) return p;
    p.syncPoints = [...p.syncPoints, { id: itemId('sp'), blockId, wordIndex, sourceMs: w.startMs, manual: true }];
    return p;
  });
}

export function removePin(id: string) {
  update((p) => { p.syncPoints = p.syncPoints.filter((s) => s.id !== id); return p; });
}

export interface DriftReport {
  blockId: string;
  spokenMs: number;
  footageMs: number;
  driftMs: number;
}

/**
 * How far each block's audio has drifted from the footage it narrates. This is
 * what the pins correct, and what the editor can show honestly.
 */
export function driftIn(p: Project): DriftReport[] {
  return p.blocks
    .filter((b) => b.audioUrl && b.words?.length)
    .map((b) => {
      const ws = b.words!;
      const footageMs = (ws[ws.length - 1]?.endMs ?? 0) - (ws[0]?.startMs ?? 0);
      const spokenMs = b.durationMs;
      return { blockId: b.id, spokenMs, footageMs, driftMs: spokenMs - footageMs };
    })
    .filter((d) => Math.abs(d.driftMs) > 150);
}

/**
 * Fit the footage to the voice, pin by pin.
 *
 * Each stretch of footage between two pins is sped up or slowed to match how
 * long the new voice takes over the same words. Speed is clamped: past about a
 * quarter either way the picture reads as wrong, so beyond that the last frame
 * is held instead.
 */
/**
 * Fit the footage to the voice WITHOUT changing playback speed.
 *
 * An earlier version set a different speed per paragraph so each one lasted
 * exactly as long as its new voice. The speed then jumped at every boundary,
 * which is what made the video look like it was cutting abruptly. Ramping
 * picture to match audio never looks right.
 *
 * Instead the picture always plays at 1x. Where the voice is shorter than the
 * footage the tail is trimmed; where it is longer the last frame is held. On a
 * screen recording both are invisible.
 */
export function fitFootageToVoice() {
  let adjusted = 0;
  update((p) => {
    const owned = p.segments.filter((x) => x.blockId);
    if (!owned.length) return p;
    if (!p.blocks.some((b) => b.audioUrl)) return p;

    // Everything plays at its natural pace, always.
    owned.forEach((s2) => { s2.speed = 1; delete s2.holdTailMs; });

    /*
     * Fit the WHOLE recording to the WHOLE voiceover, not paragraph by
     * paragraph. Trimming each paragraph to its own voice length made the
     * footage jump at every boundary and turned one continuous recording into
     * forty fragments. A screen recording should keep playing; only the total
     * length has to match.
     */
    const footageMs = owned.reduce((n, s2) => n + s2.durationMs, 0);
    const voiceMs = p.blocks.reduce((n, b) => n + b.durationMs, 0);
    const diff = voiceMs - footageMs;

    if (Math.abs(diff) > 60) {
      const last = owned.sort((a, b) => a.startMs - b.startMs)[owned.length - 1];
      if (diff < 0) last.durationMs = Math.max(200, last.durationMs + diff);
      else last.holdTailMs = diff;
      adjusted++;
    }

    // Lay it back out end to end.
    let at = 0;
    p.blocks.forEach((b) => {
      const mine = p.segments.filter((x) => x.blockId === b.id).sort((x, y) => x.startMs - y.startMs);
      if (!mine.length) { at += b.durationMs; return; }
      mine.forEach((s2) => { s2.startMs = at; at += s2.durationMs + (s2.holdTailMs || 0); });
    });
    p.segments = [...p.segments].sort((x, y) => x.startMs - y.startMs);
    return p;
  });
  return adjusted;
}

export function syncErrorMs(p: Project) {
  return p.blocks.map((b) => {
    const segs = p.segments.filter((x) => x.blockId === b.id);
    const shown = segs.reduce((n, s2) => n + s2.durationMs + (s2.holdTailMs || 0), 0);
    return { blockId: b.id, offBy: segs.length ? shown - b.durationMs : 0 };
  }).filter((x) => Math.abs(x.offBy) > 40);
}
