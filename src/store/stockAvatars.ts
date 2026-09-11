import { update, getState } from './project';
import { itemId } from './../lib/id';
import { emit } from './avatars';
import type { Avatar } from './types';

/**
 * Ready-made avatars, loaded from a manifest rather than compiled in.
 *
 * The mechanism is here; the faces are not. Shipping stock avatars means
 * shipping footage of real people, which needs a licence covering likeness and
 * synthetic speech. That is a rights question, not a technical one, so the list
 * is loaded from a manifest you control and starts empty.
 *
 * Manifest shape, served from your own storage:
 *   { "avatars": [
 *       { "id": "amara", "name": "Amara", "clips": {
 *           "idle": "stock/amara-idle.mp4",
 *           "talking": "stock/amara-talking.mp4" } } ] }
 */

export interface StockAvatar {
  id: string;
  name: string;
  note?: string;
  clips: Record<string, string>;
}

let cache: StockAvatar[] | null = null;

export async function loadStock(): Promise<StockAvatar[]> {
  if (cache) return cache;
  try {
    const r = await fetch('/api/stock-avatars');
    if (!r.ok) { cache = []; return cache; }
    const d = await r.json() as { avatars?: StockAvatar[] };
    cache = Array.isArray(d.avatars) ? d.avatars : [];
  } catch {
    cache = [];
  }
  return cache;
}

/**
 * Add one to this project. A stock avatar needs no consent clip: the licence
 * covers the likeness, and there is no user to obtain consent from.
 */
export function useStock(s: StockAvatar): string {
  const id = itemId('av');
  const clips = Object.entries(s.clips).map(([gesture, url]) => ({
    id: itemId('gc'), gesture, url, durationMs: 0,
  }));
  const avatar: Avatar = {
    id, name: s.name, builtIn: true, status: 'ready',
    consentAt: Date.now(), clips,
  };
  update((p) => { p.avatars = [...p.avatars, avatar]; return p; });
  emit();
  return id;
}

export function stockCount() {
  return cache?.length ?? 0;
}

export function hasStock() {
  return (cache?.length ?? 0) > 0;
}

/** Avatars in this project that came from the library. */
export function stockInProject() {
  return getState().project.avatars.filter((a) => a.builtIn);
}
