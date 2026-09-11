import { getState, update } from './project';
import { itemId } from '../lib/id';
import type { Block, Effect, TextOverlay } from './types';

/**
 * Turns a finished script into on-screen treatment: a chapter title where each
 * section begins, a spotlight where the narration names something on screen,
 * and a gentle zoom on the paragraphs in between.
 *
 * Everything it makes is tagged `auto`, so a second run replaces its own work
 * and never touches anything placed by hand.
 */

const AUTO = 'auto:';
const isAuto = (id: string) => id.startsWith(AUTO);
const autoId = (kind: string) => AUTO + itemId(kind);

const CHAPTER_MS = 2600;

/**
 * A title never takes more than about a third of its paragraph. A fixed 2.6s
 * card swallows a short opening line whole, leaving no room for the zoom or
 * spotlight that paragraph deserved.
 */
const titleMsFor = (blockMs: number) => Math.max(900, Math.min(CHAPTER_MS, Math.round(blockMs * 0.35)));
const TITLE_SIZE = 54;

/** Phrases that point at something on screen rather than describing an idea. */
const POINTERS = [
  'click', 'select', 'here', 'this button', 'this menu', 'the button', 'the menu',
  'top right', 'top left', 'bottom right', 'bottom left', 'the tab', 'the field',
  'notice', 'look at', 'you can see', 'over here', 'right here', 'the icon',
];

export interface AutoOptions {
  chapters: boolean;
  zooms: boolean;
  spotlights: boolean;
}

export const DEFAULT_AUTO: AutoOptions = { chapters: true, zooms: true, spotlights: true };

/** Start time of every block, since blocks run back to back. */
function starts(blocks: Block[]) {
  const out: number[] = [];
  let t = 0;
  for (const b of blocks) { out.push(t); t += b.durationMs; }
  return out;
}

/** Sections index into the block array, so a title belongs at that block. */
function chapterAt(blocks: Block[], fromBlock: number, at: number[], title: string): TextOverlay {
  return {
    id: autoId('t'),
    text: title,
    startMs: at[fromBlock] ?? 0,
    durationMs: titleMsFor(blocks[fromBlock]?.durationMs ?? CHAPTER_MS),
    x: 0.5, y: 0.42,
    fontSize: TITLE_SIZE,
    fontWeight: '600',
    align: 'center',
    opacity: 1,
  } as TextOverlay;
}

function mentionsPointer(text: string) {
  const t = text.toLowerCase();
  return POINTERS.some((p) => t.includes(p));
}

/**
 * Where the narration points at the screen, put a spotlight; otherwise ease in
 * a small zoom. Alternating the zoom centre stops a long video feeling static
 * without ever moving far enough to look nervous.
 */
/** Screen events found by the last scan. Empty means no zooms are placed:
 *  a zoom with no reason behind it is just movement. */
let screenEvents: { atMs: number; amount: number; x: number; y: number }[] = [];

export function setScreenEvents(e: typeof screenEvents) { screenEvents = e; }
export function getScreenEvents() { return screenEvents; }

export function buildAuto(opts: AutoOptions = DEFAULT_AUTO) {
  const p = getState().project;
  const blocks = p.blocks;
  if (!blocks.length) return { chapters: 0, zooms: 0, spotlights: 0 };

  const at = starts(blocks);
  const overlays: TextOverlay[] = [];
  const effects: Effect[] = [];
  let zooms = 0;
  let spotlights = 0;

  if (opts.chapters) {
    p.sections.forEach((s) => {
      if (s.title && blocks[s.fromBlock]) overlays.push(chapterAt(blocks, s.fromBlock, at, s.title));
    });
  }

  blocks.forEach((b, i) => {
    const start = at[i];
    const dur = b.durationMs;
    if (dur < 1200) return;

    // Leave the opening of a chapter clear so the title is readable.
    const isChapterStart = opts.chapters && p.sections.some((s) => s.fromBlock === i);
    const from = isChapterStart ? start + titleMsFor(dur) : start;
    const span = start + dur - from;
    if (span < 700) return;

    if (opts.spotlights && mentionsPointer(b.text)) {
      // Where a screen event backs up the narration, aim at it; otherwise the
      // centre, which is still better than nothing for "click here".
      const ev = screenEvents.find((e) => e.atMs >= from && e.atMs < start + dur);
      effects.push({
        id: autoId('e'), type: 'spotlight',
        startMs: ev ? Math.max(from, ev.atMs - 200) : from,
        durationMs: Math.min(span, 3200),
        x: ev ? ev.x : 0.5,
        y: ev ? ev.y : 0.5,
        scale: 1.35,
      } as Effect);
      spotlights++;
      return;
    }

    // A zoom needs a reason. Without a screen event inside this paragraph
    // there is nothing worth looking closer at, so nothing is added.
    if (opts.zooms && screenEvents.length) {
      const ev = screenEvents.find((e) => e.atMs >= from && e.atMs < start + dur);
      if (!ev) return;
      effects.push({
        id: autoId('e'), type: 'zoom',
        startMs: Math.max(from, ev.atMs - 200),
        durationMs: Math.min(span, 3600),
        // Aim at what moved, pulled towards centre so it never feels lopsided.
        x: 0.5 + (ev.x - 0.5) * 0.6,
        y: 0.5 + (ev.y - 0.5) * 0.6,
        scale: 1.1 + Math.min(0.16, ev.amount * 0.4),
      } as Effect);
      zooms++;
    }
  });

  update((pp) => {
    // Replace only what a previous run made.
    pp.textOverlays = [...pp.textOverlays.filter((o) => !isAuto(o.id)), ...overlays];
    pp.effects = [...pp.effects.filter((e) => !isAuto(e.id)), ...effects];
    return pp;
  });

  return { chapters: overlays.length, zooms, spotlights };
}

export function clearAuto() {
  update((p) => {
    p.textOverlays = p.textOverlays.filter((o) => !isAuto(o.id));
    p.effects = p.effects.filter((e) => !isAuto(e.id));
    return p;
  });
}

export function autoCount() {
  const p = getState().project;
  return p.textOverlays.filter((o) => isAuto(o.id)).length + p.effects.filter((e) => isAuto(e.id)).length;
}
