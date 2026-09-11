import type { Project, TimedBase, Block } from './types';

/** Absolute start time of each block, derived from block durations in order. */
export function blockStarts(blocks: Block[]): Record<string, number> {
  const out: Record<string, number> = {};
  let t = 0;
  for (const b of blocks) {
    out[b.id] = t;
    t += b.durationMs;
  }
  return out;
}

/**
 * Option C: ripple with re-anchoring. After any block length change, every
 * anchored item is repositioned relative to its block. Pinned items keep
 * absolute time. Items with no anchor are untouched.
 */
export function reanchor<T extends TimedBase>(items: T[], starts: Record<string, number>): T[] {
  return items.map((it) => {
    if (!it.anchorBlockId || it.pinned) return it;
    const base = starts[it.anchorBlockId];
    if (base == null) return it;
    return { ...it, startMs: base + (it.offsetMs || 0) };
  });
}

export function reanchorProject(p: Project): Project {
  const starts = blockStarts(p.blocks);
  return {
    ...p,
    callouts: reanchor(p.callouts, starts),
    textOverlays: reanchor(p.textOverlays, starts),
    shapes: reanchor(p.shapes, starts),
    effects: reanchor(p.effects, starts),
  };
}

/** Attach an item to the block under it, recording the offset within that block. */
export function anchorToBlockAt<T extends TimedBase>(item: T, p: Project): T {
  const starts = blockStarts(p.blocks);
  let found: { id: string; start: number } | null = null;
  for (const b of p.blocks) {
    const s = starts[b.id];
    if (item.startMs >= s && item.startMs < s + b.durationMs) {
      found = { id: b.id, start: s };
      break;
    }
  }
  if (!found) return { ...item, anchorBlockId: null, offsetMs: 0 };
  return { ...item, anchorBlockId: found.id, offsetMs: item.startMs - found.start };
}
