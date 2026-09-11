import { getState, update, useStore } from './project';
import { projectDurationMs } from './validate';
import type { Project } from './types';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'offline' | 'conflict' | 'error';

interface Status { state: SaveState; at: number; message?: string; serverRev?: number }
let status: Status = { state: 'idle', at: 0 };
let rev = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastSerialised = '';
let loading = false;

const listeners = new Set<(s: Status) => void>();
const emit = () => listeners.forEach((l) => l({ ...status }));
export function onSave(l: (s: Status) => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export const getSaveStatus = () => status;
const set = (state: SaveState, message?: string, serverRev?: number) => {
  status = { state, at: Date.now(), message, serverRev };
  emit();
};

const LOCAL_KEY = (id: string) => `fde:project:${id}`;

/**
 * Blob URLs die with the tab. Anything still pointing at one when a project is
 * saved would come back broken, so it is marked as needing re-upload rather
 * than restored as a file that silently will not play.
 */
function stripDeadBlobs(p: Project): Project {
  const media = p.media.map((m) =>
    m.url.startsWith('blob:')
      ? { ...m, url: '', uploadState: 'failed' as const, uploadError: 'not uploaded before the page closed' }
      : m
  );
  // A blob url dies with the tab, but the stored copy does not. Keep the
  // narration when there is an audioKey, and only mark the block dirty when
  // the audio really was local-only.
  const blocks = p.blocks.map((b) => {
    if (!b.audioUrl?.startsWith('blob:')) return b;
    return b.audioKey
      ? { ...b, audioUrl: null }
      : { ...b, audioUrl: null, dirty: true };
  });
  const avatars = p.avatars.map((a) => ({
    ...a,
    clips: a.clips.filter((c) => !c.url.startsWith('blob:')),
  }));
  return { ...p, media, blocks, avatars };
}

function serialise(p: Project) {
  return JSON.stringify(stripDeadBlobs(p));
}

/** Autosave is debounced: typing in the transcript should not be one write per keystroke. */
const DEBOUNCE_MS = 1200;

export function markDirty() {
  if (loading) return;
  const p = getState().project;
  const now = serialise(p);
  if (now === lastSerialised) return;
  if (status.state !== 'conflict') set('dirty');
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void save(); }, DEBOUNCE_MS);
}

export async function save(force = false): Promise<boolean> {
  if (loading) return false;
  if (status.state === 'conflict' && !force) return false;
  const p = getState().project;
  const doc = stripDeadBlobs(p);
  const text = JSON.stringify(doc);
  if (!force && text === lastSerialised) { set('saved'); return true; }

  set('saving');
  // Local first, so a network failure never loses the work.
  try { localStorage.setItem(LOCAL_KEY(p.id), text); } catch { /* quota */ }

  try {
    const r = await fetch(`/api/projects/${encodeURIComponent(p.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: p.name, doc, rev: force ? undefined : rev || undefined,
        durationMs: projectDurationMs(p),
      }),
    });
    const raw = await r.text();
    let d: { ok?: boolean; rev?: number; error?: string; code?: string; serverRev?: number };
    try { d = JSON.parse(raw); }
    catch { set('offline', 'saved on this device only'); return false; }

    if (r.status === 409 && d.code === 'stale_rev') {
      set('conflict', 'someone else saved a newer version', d.serverRev);
      return false;
    }
    if (d.code === 'no_db') { set('offline', 'saved on this device only, no database is connected'); lastSerialised = text; return false; }
    if (!r.ok || d.error) { set('error', d.error || `save failed (${r.status})`); return false; }

    rev = d.rev || rev + 1;
    lastSerialised = text;
    set('saved');
    return true;
  } catch (e) {
    set('offline', String((e as Error).message));
    return false;
  }
}

/** Take the server's copy, discarding local changes. */
export async function resolveTakeTheirs(id: string) {
  set('saving');
  await load(id, true);
  set('saved');
}

/** Keep what is on screen and overwrite the server. */
export async function resolveKeepMine() {
  await save(true);
}

export async function load(id: string, replaceLocal = false): Promise<boolean> {
  loading = true;
  try {
    const r = await fetch(`/api/projects/${encodeURIComponent(id)}`);
    if (r.ok) {
      const d = await r.json() as { doc: Project; rev: number };
      if (d?.doc) {
        rev = d.rev || 1;
        update(() => d.doc, { history: false });
        lastSerialised = JSON.stringify(stripDeadBlobs(d.doc));
        set('saved');
        return true;
      }
    }
    if (!replaceLocal) {
      // No server copy: fall back to whatever this device has.
      const local = localStorage.getItem(LOCAL_KEY(id));
      if (local) {
        update(() => JSON.parse(local) as Project, { history: false });
        lastSerialised = local;
        set('offline', 'loaded from this device');
        return true;
      }
    }
    return false;
  } catch {
    const local = localStorage.getItem(LOCAL_KEY(id));
    if (local) {
      update(() => JSON.parse(local) as Project, { history: false });
      lastSerialised = local;
      set('offline', 'loaded from this device');
      return true;
    }
    return false;
  } finally {
    loading = false;
  }
}

export interface ProjectRow {
  id: string; name: string; folder: string | null; state: string;
  owner_email: string | null; updated_at: number; updated_by: string | null;
  duration_ms: number; thumb: string | null; rev: number;
}

export async function listProjects(q?: string, folder?: string): Promise<ProjectRow[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (folder) params.set('folder', folder);
  const r = await fetch(`/api/projects${params.toString() ? '?' + params : ''}`);
  if (!r.ok) return [];
  const d = await r.json() as { projects?: ProjectRow[] };
  return d.projects || [];
}

export function useSaveStatus() {
  return useStore(() => status);
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__fdePersist = { save, load, markDirty, getSaveStatus, listProjects };
}
