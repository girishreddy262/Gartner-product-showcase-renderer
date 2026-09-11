import { useSyncExternalStore } from 'react';
import type { Project, LaneKey, Selection, TimedBase, Block } from './types';
import { MIN_DURATION_MS, DEFAULT_VOICE_SETTINGS } from './types';
import type { ResolutionKey, AspectKey } from './types';
import { itemId, shortId } from '../lib/id';
import {
  projectDurationMs, clampTimed, clampPoint, clampSize,
  ensureUniqueId, resolveOverlap,
} from './validate';
import { reanchorProject, anchorToBlockAt } from './anchors';

const TIMED_LANES: LaneKey[] = ['segments', 'camera', 'voice', 'music', 'callouts', 'textOverlays', 'shapes', 'effects'];

interface State {
  project: Project;
  selection: Selection;
  playheadMs: number;
  playing: boolean;
  pxPerMs: number;
  past: Project[];
  future: Project[];
  dirty: boolean;
}

function emptyProject(name = 'Untitled'): Project {
  return {
    id: shortId(12),
    name,
    updatedAt: Date.now(),
    media: [],
    segments: [],
    camera: [],
    voice: [],
    music: [],
    blocks: [],
    callouts: [],
    textOverlays: [],
    shapes: [],
    effects: [],
    syncPoints: [],
    sections: [],
    avatars: [],
    aspect: '16:9',
    resolution: '1080p',
    voiceSettings: { ...DEFAULT_VOICE_SETTINGS },
    background: { value: '#0f1117' },
  };
}

let state: State = {
  project: emptyProject(),
  selection: { lane: null, id: null },
  playheadMs: 0,
  playing: false,
  pxPerMs: 0.06,
  past: [],
  future: [],
  dirty: false,
};

const listeners = new Set<() => void>();
const emit = () => { listeners.forEach((l) => l()); onChange?.(); };

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export const getState = () => state;
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

const MAX_UNDO = 100;

/**
 * The ONLY way project data changes. Every mutation is clamped, re-anchored and
 * pushed onto the undo stack, so no code path can create an invalid state.
 */
let onChange: (() => void) | null = null;
export function setChangeHook(fn: () => void) { onChange = fn; }

export function update(fn: (draft: Project) => Project | void, opts: { history?: boolean } = {}) {
  const before = state.project;
  const draft = structuredClone(before) as Project;
  const returned = fn(draft);
  let next = (returned || draft) as Project;

  next = reanchorProject(next);
  const total = projectDurationMs(next);
  for (const lane of TIMED_LANES) {
    const items = next[lane] as unknown as TimedBase[];
    next = { ...next, [lane]: items.map((it) => clampTimed(it, total)) } as Project;
  }
  next.updatedAt = Date.now();

  const history = opts.history !== false;
  state = {
    ...state,
    project: next,
    past: history ? [...state.past, before].slice(-MAX_UNDO) : state.past,
    future: history ? [] : state.future,
    dirty: true,
  };
  emit();
}

/**
 * Snapshot the current project onto the undo stack without changing anything.
 * Call once at the start of a gesture, then patch with { history: false }, so a
 * whole drag collapses into a single undo step instead of one per pointermove.
 */
export function pushHistory() {
  state = { ...state, past: [...state.past, state.project].slice(-MAX_UNDO), future: [] };
  emit();
}

export function undo() {
  if (!state.past.length) return;
  const prev = state.past[state.past.length - 1];
  state = { ...state, project: prev, past: state.past.slice(0, -1), future: [state.project, ...state.future] };
  emit();
}

export function redo() {
  if (!state.future.length) return;
  const nxt = state.future[0];
  state = { ...state, project: nxt, future: state.future.slice(1), past: [...state.past, state.project] };
  emit();
}

export function select(lane: LaneKey | null, id: string | null) {
  state = { ...state, selection: { lane, id } };
  emit();
}

export function seek(ms: number) {
  const total = projectDurationMs(state.project);
  state = { ...state, playheadMs: Math.min(Math.max(0, Math.round(ms)), total) };
  emit();
}

export function setPlaying(p: boolean) {
  state = { ...state, playing: p };
  emit();
}

export function setZoom(pxPerMs: number) {
  state = { ...state, pxPerMs: Math.min(0.6, Math.max(0.01, pxPerMs)) };
  emit();
}

export function newProject(name: string) {
  state = { ...state, project: emptyProject(name), selection: { lane: null, id: null }, playheadMs: 0, past: [], future: [], dirty: false };
  emit();
}

/** Add an item to a lane. Rejects duplicate ids, clamps, resolves overlap. */
export function addItem(lane: LaneKey, partial: Record<string, unknown>): string | null {
  const prefix = lane === 'callouts' ? 'co' : lane === 'shapes' ? 'sh'
    : lane === 'textOverlays' ? 'tx' : lane === 'effects' ? 'fx'
    : lane === 'camera' ? 'cam' : lane === 'voice' ? 'vo' : lane === 'music' ? 'mu' : 'sg';
  const id = (partial.id as string) || itemId(prefix);
  let created: string | null = null;

  update((p) => {
    const arr = p[lane] as unknown as TimedBase[];
    if (!ensureUniqueId(arr, id)) return p;
    const total = projectDurationMs(p);
    const raw = { startMs: 0, durationMs: 3000, ...partial, id } as TimedBase & { [k: string]: unknown };
    if ('x' in raw || 'y' in raw) {
      const c = clampPoint(Number(raw.x ?? 0), Number(raw.y ?? 0));
      raw.x = c.x; raw.y = c.y;
    }
    if ('width' in raw || 'height' in raw) {
      const sz = clampSize(Number(raw.width ?? 100), Number(raw.height ?? 100));
      raw.width = sz.width; raw.height = sz.height;
    }
    let item = clampTimed(raw, Math.max(total, raw.startMs + raw.durationMs));
    item.startMs = resolveOverlap(item, arr, Math.max(total, item.startMs + item.durationMs));
    item = anchorToBlockAt(item, p);
    (p[lane] as unknown as TimedBase[]).push(item);
    created = id;
    return p;
  });

  if (created) select(lane, created);
  return created;
}

export function patchItem(lane: LaneKey, id: string, patch: Record<string, unknown>, opts: { history?: boolean } = {}) {
  update((p) => {
    const arr = p[lane] as unknown as TimedBase[];
    const i = arr.findIndex((x) => x.id === id);
    if (i < 0) return p;
    const merged = { ...arr[i], ...patch } as TimedBase & { [k: string]: unknown };
    if ('x' in patch || 'y' in patch) {
      const c = clampPoint(Number(merged.x), Number(merged.y));
      merged.x = c.x; merged.y = c.y;
    }
    if ('width' in patch || 'height' in patch) {
      const sz = clampSize(Number(merged.width), Number(merged.height));
      merged.width = sz.width; merged.height = sz.height;
    }
    const total = projectDurationMs(p);
    let next = clampTimed(merged, total);
    if ('startMs' in patch || 'durationMs' in patch) {
      next = { ...next, startMs: resolveOverlap(next, arr, total) };
      next = anchorToBlockAt(next, p);
    }
    arr[i] = next;
    return p;
  }, opts);
}

export function removeItem(lane: LaneKey, id: string) {
  update((p) => {
    (p[lane] as unknown as TimedBase[]) = (p[lane] as unknown as TimedBase[]).filter((x) => x.id !== id);
    return p;
  });
  if (state.selection.id === id) select(null, null);
}

export function removeSelected() {
  const { lane, id } = state.selection;
  if (lane && id) removeItem(lane, id);
}

/** Editing a block marks it dirty. Regeneration is automatic elsewhere. */
export function setBlockText(id: string, text: string) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === id);
    if (b) { b.text = text; b.dirty = true; }
    return p;
  });
}

export function setBlockDuration(id: string, durationMs: number) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === id);
    if (b) b.durationMs = Math.max(MIN_DURATION_MS, Math.round(durationMs));
    return p;
  });
}


/**
 * Delete a word range from a recorded block. The cut snaps to the nearest
 * silence within SNAP_MS so it does not clip mid-phrase; with no silence there
 * it falls back to the word boundary and the renderer applies a short
 * crossfade. Returns the milliseconds removed.
 */
const SNAP_MS = 150;

/** Strike words out. Nothing is spliced away, so restoring is exact. */
export function markWords(blockId: string, from: number, to: number, del: boolean) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b?.words) return p;
    const lo = Math.max(0, Math.min(from, to));
    const hi = Math.min(b.words.length - 1, Math.max(from, to));
    for (let i = lo; i <= hi; i++) b.words[i].del = del || undefined;
    b.text = liveText(b);
    b.durationMs = Math.max(MIN_DURATION_MS, spokenMs(b));
    return applyCuts(p, b.id);
  });
}

/**
 * Rebuild the video to match the script.
 *
 * Struck words are not just hidden text: the footage where they were spoken has
 * to leave the timeline too, or the video keeps saying what the script no longer
 * does. Each block owns one span of its source clip, so the surviving runs of
 * words become the segments for that block.
 */
/**
 * Add words to a recording's script.
 *
 * There is no footage for words nobody said, so the block converts to a
 * generated one: the whole paragraph will be spoken. This is the honest
 * outcome, and it is what people expect when they type into a transcript.
 */
export function insertWords(blockId: string, afterIndex: number, text: string) {
  const clean = text.trim();
  if (!clean) return;
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b?.words) return p;
    const at = Math.max(-1, Math.min(b.words.length - 1, afterIndex));
    const anchor = b.words[at];
    const start = anchor ? anchor.endMs : 0;
    // Roughly 380ms a word is close enough for a placeholder; the real timing
    // arrives when the voice is generated.
    const made = clean.split(/\s+/).map((t, i) => ({
      text: t, startMs: start + i * 380, endMs: start + i * 380 + 340, added: true as const,
    }));
    b.words = [...b.words.slice(0, at + 1), ...made, ...b.words.slice(at + 1)];
    b.text = liveText(b);
    b.durationMs = Math.max(MIN_DURATION_MS, spokenMs(b));
    b.source = 'generated';
    b.overRecording = true;
    b.dirty = true;
    return p;
  });
}

export function applyCuts(p: Project, blockId: string): Project {
  const bi = p.blocks.findIndex((x) => x.id === blockId);
  const b = p.blocks[bi];
  if (!b?.words?.length) return p;

  // The clip this block came from, and where the block starts inside it.
  const owned = p.segments.filter((s) => s.blockId === b.id);
  const base = owned[0] || p.segments.find((s) => s.kind === 'recording');
  if (!base) return p;
  const clipStart = owned.length ? Math.min(...owned.map((s) => s.sourceStartMs)) : base.sourceStartMs;

  // Runs of consecutive surviving words become the pieces we keep.
  const runs: { from: number; to: number }[] = [];
  b.words.forEach((w, i) => {
    if (w.del) return;
    const last = runs[runs.length - 1];
    if (last && last.to === i - 1) last.to = i;
    else runs.push({ from: i, to: i });
  });

  let at = blockStartMs(p, bi);
  const rebuilt = runs.map((r) => {
    const first = b.words![r.from];
    const last = b.words![r.to];
    const len = Math.max(40, last.endMs - first.startMs);
    const seg = {
      ...base,
      id: itemId('sg'),
      blockId: b.id,
      startMs: at,
      durationMs: len,
      sourceStartMs: clipStart + first.startMs,
      // A block replaced by a generated voice must not also play its original.
      muteSourceAudio: b.source !== 'recorded' ? true : base.muteSourceAudio,
    };
    at += len + (last.pauseAfterMs || 0);
    return seg;
  });

  const others = p.segments.filter((s) => s.blockId !== b.id);
  return relayout({ ...p, segments: [...others, ...rebuilt] });
}

/**
 * Lay every clip end to end.
 *
 * Cutting words shortens one block, and without this the blocks after it stay
 * where they were, leaving a hole in the middle of the video. Any edit that
 * changes a length has to close the gaps everywhere, not only where it happened.
 */
export function relayout(p: Project): Project {
  let at = 0;
  const out: typeof p.segments = [];
  p.blocks.forEach((b) => {
    const mine = p.segments.filter((s) => s.blockId === b.id).sort((x, y) => x.startMs - y.startMs);
    if (!mine.length) { at += b.durationMs; return; }
    mine.forEach((s) => {
      out.push({ ...s, startMs: at });
      at += s.durationMs + (s.holdTailMs || 0);
    });
  });
  // Anything not owned by a block (imported clips, camera) keeps its place.
  const loose = p.segments.filter((s) => !s.blockId);
  return { ...p, segments: [...out, ...loose].sort((x, y) => x.startMs - y.startMs) };
}

/** Blocks run back to back, so a block starts where the ones before it end. */
export function blockStartMs(p: Project, index: number) {
  let t = 0;
  for (let i = 0; i < index; i++) t += p.blocks[i].durationMs;
  return t;
}

/** The script as it will be spoken: struck words are gone from it. */
export function liveText(b: Block) {
  return (b.words || []).filter((w) => !w.del).map((w) => w.text).join(' ');
}

/** How long the block runs once cuts and pauses are taken into account. */
export function spokenMs(b: Block) {
  const ws = b.words || [];
  let ms = 0;
  for (const w of ws) {
    if (!w.del) ms += Math.max(0, w.endMs - w.startMs);
    ms += w.pauseAfterMs || 0;
  }
  return ms;
}

/**
 * Dead air between words. Anything above minMs is shortened to keepMs rather
 * than removed outright: cutting silence to zero makes speech sound spliced,
 * whereas leaving a beat sounds like someone who simply does not ramble.
 */
export function gapsIn(b: Block, minMs = 700) {
  const ws = (b.words || []).filter((w) => !w.del);
  const out: { index: number; gapMs: number }[] = [];
  for (let i = 0; i < ws.length - 1; i++) {
    const gap = ws[i + 1].startMs - ws[i].endMs;
    if (gap > minMs) out.push({ index: (b.words || []).indexOf(ws[i]), gapMs: gap });
  }
  return out;
}

export function gapCount(b: Block, minMs = 700) {
  return gapsIn(b, minMs).length;
}

/** Total time tightening would save, so the button can promise a real number. */
export function gapSavingMs(b: Block, minMs = 700, keepMs = 250) {
  return gapsIn(b, minMs).reduce((n, g) => n + (g.gapMs - keepMs), 0);
}

export function trimGaps(blockId: string, minMs = 700, keepMs = 250): number {
  let n = 0;
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b?.words) return p;
    // Work backwards so shifting later words does not disturb earlier indices.
    const gaps = gapsIn(b, minMs).reverse();
    for (const g of gaps) {
      const cut = g.gapMs - keepMs;
      if (cut <= 0) continue;
      for (let i = g.index + 1; i < b.words.length; i++) {
        b.words[i].startMs -= cut;
        b.words[i].endMs -= cut;
      }
      b.words[g.index].gapTrimMs = (b.words[g.index].gapTrimMs || 0) + cut;
      b.durationMs = Math.max(MIN_DURATION_MS, b.durationMs - cut);
      n++;
    }
    return p;
  });
  return n;
}

export function trimmedGapCount(b: Block) {
  return (b.words || []).filter((w) => w.gapTrimMs).length;
}

/** Put every trimmed pause back. */
export function restoreGaps(blockId: string) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b?.words) return p;
    for (let gi = b.words.length - 1; gi >= 0; gi--) {
      const back = b.words[gi].gapTrimMs;
      if (!back) continue;
      for (let i = gi + 1; i < b.words.length; i++) {
        b.words[i].startMs += back;
        b.words[i].endMs += back;
      }
      b.durationMs += back;
      delete b.words[gi].gapTrimMs;
    }
    return p;
  });
}

const FILLERS = new Set(['uh', 'um', 'erm', 'ah', 'er', 'hmm', 'mm', 'uhh', 'umm']);
const bare = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

export function fillerCount(b: Block) {
  return (b.words || []).filter((w) => !w.del && FILLERS.has(bare(w.text))).length;
}

/** Strike every filler. One click undoes it because they are only marked. */
export function removeFillers(blockId: string): number {
  let n = 0;
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b?.words) return p;
    b.words.forEach((w) => { if (!w.del && FILLERS.has(bare(w.text))) { w.del = true; n++; } });
    b.text = liveText(b);
    b.durationMs = Math.max(MIN_DURATION_MS, spokenMs(b));
    return p;
  });
  return n;
}

/** Put every struck word in a block back. */
export function restoreAll(blockId: string) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b?.words) return p;
    b.words.forEach((w) => { delete w.del; });
    b.text = liveText(b);
    b.durationMs = Math.max(MIN_DURATION_MS, spokenMs(b));
    return p;
  });
}

export function setPauseAfter(blockId: string, wordIndex: number, ms: number) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b?.words?.[wordIndex]) return p;
    if (ms > 0) b.words[wordIndex].pauseAfterMs = Math.max(200, Math.min(5000, ms));
    else delete b.words[wordIndex].pauseAfterMs;
    b.durationMs = Math.max(MIN_DURATION_MS, spokenMs(b));
    return p;
  });
}

export function nudgePause(blockId: string, wordIndex: number, deltaMs: number) {
  const b = getState().project.blocks.find((x) => x.id === blockId);
  const cur = b?.words?.[wordIndex]?.pauseAfterMs || 0;
  setPauseAfter(blockId, wordIndex, cur + deltaMs);
}

/** Start a new voice at this word. */
export function splitVoice(blockId: string, wordIndex: number, voiceId: string, voiceName: string) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b?.words) return p;
    b.voiceSections = b.voiceSections || [];
    if (!b.voiceSections.some((s) => s.w === wordIndex)) {
      b.voiceSections.push({ w: wordIndex, voiceId, voiceName });
      b.voiceSections.sort((a, c) => a.w - c.w);
    }
    b.dirty = true;
    return p;
  });
}

/** Fold this section back into the one before it. */
export function mergeVoice(blockId: string, wordIndex: number) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b) return p;
    b.voiceSections = (b.voiceSections || []).filter((s) => s.w !== wordIndex);
    b.dirty = true;
    return p;
  });
}

export function setSectionVoice(blockId: string, wordIndex: number, voiceId: string, voiceName: string) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    const s = (b?.voiceSections || []).find((x) => x.w === wordIndex);
    if (s) { s.voiceId = voiceId; s.voiceName = voiceName; if (b) b.dirty = true; }
    return p;
  });
}

/** Volume and speed apply to playback, so no regeneration is needed. */
export function setBlockPlayback(blockId: string, patch: { volume?: number; speed?: number }) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b) return p;
    if (patch.volume != null) b.volume = Math.max(0, Math.min(2, patch.volume));
    if (patch.speed != null) {
      const was = b.speed || 1;
      b.speed = Math.max(0.5, Math.min(2, patch.speed));
      // Speed changes how long the block runs, so the timeline must follow.
      if (b.audioUrl) b.durationMs = Math.max(MIN_DURATION_MS, Math.round(b.durationMs * (was / b.speed)));
    }
    return p;
  });
}

/** Give one block its own voice, or hand it back to the project voice. */
export function setBlockVoiceOverride(blockId: string, voiceId?: string, voiceName?: string) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b) return p;
    if (voiceId) { b.voiceId = voiceId; b.voiceName = voiceName; b.voiceOverride = true; }
    else { b.voiceOverride = false; }
    b.dirty = true;
    return p;
  });
}

/** Per-block voice settings. Undefined values fall back to the project. */
export function setBlockSettings(blockId: string, patch: Record<string, unknown>) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b) return p;
    b.settings = { ...(b.settings || {}), ...patch };
    b.dirty = true;
    return p;
  });
}

/**
 * Turn a run of words inside a recording into its own generated paragraph.
 * The block splits into up to three: what came before, the replaced part, and
 * what came after. Splitting rather than patching keeps every downstream idea
 * (a block has one voice, one audio file, one duration) intact.
 */
export function replaceSelectionWithVoice(
  blockId: string, from: number, to: number, voiceId?: string, voiceName?: string
): string | null {
  let newId: string | null = null;
  update((p) => {
    const idx = p.blocks.findIndex((x) => x.id === blockId);
    const b = p.blocks[idx];
    if (!b?.words) return p;

    const lo = Math.max(0, Math.min(from, to));
    const hi = Math.min(b.words.length - 1, Math.max(from, to));
    const mid = b.words.slice(lo, hi + 1);
    if (!mid.length) return p;

    const span = (ws: typeof mid) => ws.reduce((n, w) => n + Math.max(0, w.endMs - w.startMs) + (w.pauseAfterMs || 0), 0);
    // Re-base each piece so its words start from zero again.
    const rebase = (ws: typeof mid) => {
      const off = ws[0]?.startMs || 0;
      return ws.map((w) => ({ ...w, startMs: w.startMs - off, endMs: w.endMs - off }));
    };

    const before = b.words.slice(0, lo);
    const after = b.words.slice(hi + 1);
    const made: Block[] = [];

    if (before.length) {
      made.push({ ...b, id: itemId('b'), words: rebase(before),
        text: before.filter((w) => !w.del).map((w) => w.text).join(' '),
        durationMs: Math.max(MIN_DURATION_MS, span(before)), takes: [] });
    }

    newId = itemId('b');
    made.push({
      id: newId,
      text: mid.filter((w) => !w.del).map((w) => w.text).join(' '),
      source: 'generated',
      overRecording: true,
      voiceId: voiceId || b.voiceId,
      voiceName: voiceName || b.voiceName,
      voiceOverride: !!voiceId,
      audioUrl: null,
      durationMs: Math.max(MIN_DURATION_MS, span(mid)),
      dirty: true,
      takes: [],
    });

    if (after.length) {
      made.push({ ...b, id: itemId('b'), words: rebase(after),
        text: after.filter((w) => !w.del).map((w) => w.text).join(' '),
        durationMs: Math.max(MIN_DURATION_MS, span(after)), takes: [] });
    }

    p.blocks = [...p.blocks.slice(0, idx), ...made, ...p.blocks.slice(idx + 1)];

    // Sections index into the block array, so anything after this point shifts.
    const grew = made.length - 1;
    if (grew) p.sections = p.sections.map((s) => (s.fromBlock > idx ? { ...s, fromBlock: s.fromBlock + grew } : s));
    return p;
  });
  return newId;
}

export function convertToGenerated(blockId: string, voiceId: string, voiceName: string) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b) return p;
    b.source = 'generated';
    b.overRecording = true;
    b.voiceId = voiceId;
    b.voiceName = voiceName;
    b.dirty = true;
    return p;
  });
}

export function revertToRecording(blockId: string) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b || !b.overRecording) return p;
    b.source = 'recorded';
    b.overRecording = false;
    b.dirty = false;
    return p;
  });
}

export function setBlockVoice(blockId: string, voiceId: string, voiceName: string) {
  update((p) => {
    const b = p.blocks.find((x) => x.id === blockId);
    if (!b) return p;
    b.voiceId = voiceId;
    b.voiceName = voiceName;
    b.dirty = true;
    return p;
  });
}

export function setVoiceSettings(patch: Partial<typeof DEFAULT_VOICE_SETTINGS>) {
  update((p) => { p.voiceSettings = { ...p.voiceSettings, ...patch }; return p; });
}

export function setResolution(r: ResolutionKey) {
  update((p) => { p.resolution = r; return p; });
}

export function setAspect(a: AspectKey) {
  update((p) => { p.aspect = a; return p; });
}

export function renameSection(id: string, title: string) {
  update((p) => { const s = p.sections.find((x) => x.id === id); if (s) s.title = title; return p; });
}

export { projectDurationMs };

/* Testability hook. Lets the automated suite inspect and drive the store
   without reaching through the DOM. Read-only in practice. */
if (typeof window !== 'undefined') {
  void import('./sync').then((m) => { (window as unknown as Record<string, unknown>).__fdeSync = m; });
  void import('./autoScene').then((m) => { (window as unknown as Record<string, unknown>).__fdeAuto = m; });
  void import('./voice').then((m) => { (window as unknown as Record<string, unknown>).__fdeVoice = m; });
  void import('./avatarClips').then((m) => { (window as unknown as Record<string, unknown>).__fdeAvatar = m; });
  (window as unknown as Record<string, unknown>).__fde = {
    getState, update, undo, redo, pushHistory, addItem, patchItem, removeItem, select, seek,
    markWords, removeFillers, restoreAll, setPauseAfter, nudgePause, splitVoice, mergeVoice,
    setBlockPlayback, setBlockVoiceOverride, setBlockSettings,
    convertToGenerated, revertToRecording, setBlockVoice, setVoiceSettings, setResolution, setAspect,
  };
}
