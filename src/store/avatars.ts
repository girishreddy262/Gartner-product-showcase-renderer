import { update, getState } from './project';
import { uploadFile, signedUrl } from '../lib/api';
import { itemId } from '../lib/id';
import { GESTURES, REQUIRED_GESTURES } from './types';
import type { Avatar, GestureClip } from './types';

type Listener = () => void;
const listeners = new Set<Listener>();
export const emit = () => listeners.forEach((l) => l());
export function onAvatars(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }

export function createAvatar(name: string): string {
  const id = itemId('av');
  update((p) => {
    p.avatars.push({ id, name, builtIn: false, status: 'draft', clips: [] });
    return p;
  });
  return id;
}

export function getAvatar(id: string): Avatar | undefined {
  return getState().project.avatars.find((a) => a.id === id);
}

/** True once consent plus the two clips everything falls back to are captured. */
export function isComplete(a: Avatar) {
  const have = new Set(a.clips.map((c) => c.gesture));
  return REQUIRED_GESTURES.every((g) => have.has(g));
}

export function missingRequired(a: Avatar) {
  const have = new Set(a.clips.map((c) => c.gesture));
  return REQUIRED_GESTURES.filter((g) => !have.has(g));
}

/**
 * Use footage you already have as a gesture, rather than recording a new take.
 *
 * The pipeline downstream is identical: addClip takes a File either way. The
 * only extra work is reading the duration, which the recorder knew and a
 * picked file does not.
 */
export async function importClip(avatarId: string, gesture: string, file: File) {
  // An audio file loads happily into a <video> element and reports a duration,
  // so duration alone is not proof of a picture. videoWidth is.
  const probe = await new Promise<{ ms: number; w: number }>((res) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      res({ ms: Math.round((v.duration || 0) * 1000), w: v.videoWidth || 0 });
      URL.revokeObjectURL(v.src);
    };
    v.onerror = () => res({ ms: 0, w: 0 });
    v.src = URL.createObjectURL(file);
  });
  const durationMs = probe.ms;
  if (!probe.w) throw new Error('that file has no picture in it, choose a video of yourself');
  if (!durationMs) throw new Error('that file does not look like a video');
  // Lip-sync needs enough of a face to work from; a two-second clip produces
  // visibly poor results.
  if (durationMs < 2000) throw new Error('that clip is too short, use at least a few seconds');
  return addClip(avatarId, gesture, file, durationMs);
}

/**
 * Store one gesture take. It is usable immediately from the local blob and
 * uploaded in the background, the same optimistic pattern as media import.
 */
export async function addClip(avatarId: string, gesture: string, file: File, durationMs: number) {
  const blobUrl = URL.createObjectURL(file);
  const clip: GestureClip = { id: itemId('gc'), gesture, url: blobUrl, durationMs };

  update((p) => {
    const a = p.avatars.find((x) => x.id === avatarId);
    if (!a) return p;
    // A retake replaces the previous take of the same gesture.
    a.clips = a.clips.filter((c) => c.gesture !== gesture).concat(clip);
    if (gesture === 'consent') { a.consentClipUrl = blobUrl; a.consentAt = Date.now(); }
    return p;
  });
  emit();

  try {
    const { key } = await uploadFile(file);
    update((p) => {
      const a = p.avatars.find((x) => x.id === avatarId);
      const c = a?.clips.find((x) => x.id === clip.id);
      if (c) c.url = key;
      if (a && gesture === 'consent') a.consentClipUrl = key;
      return p;
    }, { history: false });
    emit();
  } catch (e) {
    update((p) => {
      const a = p.avatars.find((x) => x.id === avatarId);
      if (a) a.error = String((e as Error).message);
      return p;
    }, { history: false });
    emit();
  }
}

export function removeClip(avatarId: string, gesture: string) {
  update((p) => {
    const a = p.avatars.find((x) => x.id === avatarId);
    if (a) a.clips = a.clips.filter((c) => c.gesture !== gesture);
    return p;
  });
  emit();
}

export function renameAvatar(id: string, name: string) {
  update((p) => { const a = p.avatars.find((x) => x.id === id); if (a) a.name = name; return p; });
  emit();
}

export function deleteAvatar(id: string) {
  update((p) => { p.avatars = p.avatars.filter((a) => a.id !== id); return p; });
  emit();
}

/** Hand the idle clip to the provider so it can build a face model. */
export async function prepareAvatar(id: string) {
  const a = getAvatar(id);
  if (!a || !isComplete(a)) return;
  const idle = a.clips.find((c) => c.gesture === 'idle');
  if (!idle || idle.url.startsWith('blob:')) {
    update((p) => { const x = p.avatars.find((v) => v.id === id); if (x) x.error = 'Still uploading, try again in a moment.'; return p; }, { history: false });
    emit();
    return;
  }

  update((p) => { const x = p.avatars.find((v) => v.id === id); if (x) { x.status = 'preparing'; x.error = undefined; } return p; }, { history: false });
  emit();

  try {
    const videoUrl = await signedUrl(idle.url);
    const r = await fetch('/api/avatar-prepare', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoUrl, name: a.name }),
    });
    // An unreachable or misrouted endpoint returns HTML, so read text first:
    // a JSON parse failure would otherwise surface as gibberish to the user.
    const raw = await r.text();
    let d: { ready?: boolean; modelRef?: string; error?: string };
    try { d = JSON.parse(raw); }
    catch { throw new Error(r.ok ? 'the avatar service replied unexpectedly' : `the avatar service is unavailable (${r.status})`); }
    if (d.error) throw new Error(d.error);
    update((p) => {
      const x = p.avatars.find((v) => v.id === id);
      if (x) { x.status = 'ready'; x.modelRef = d.modelRef || undefined; }
      return p;
    }, { history: false });
  } catch (e) {
    update((p) => {
      const x = p.avatars.find((v) => v.id === id);
      if (x) { x.status = 'failed'; x.error = String((e as Error).message); }
      return p;
    }, { history: false });
  }
  emit();
}

/** A still from the idle clip, so an avatar reads as a face not an icon. */
export function thumbnailFor(av: Avatar): Promise<string | null> {
  const clip = av.clips.find((c) => c.gesture === 'idle') || av.clips[0];
  if (!clip) return Promise.resolve(null);
  const cached = thumbs.get(av.id);
  if (cached) return Promise.resolve(cached);
  return (async () => {
    try {
      const src = clip.url.startsWith('blob:') ? clip.url : await signedUrl(clip.url);
      const url = await frameFrom(src);
      if (url) thumbs.set(av.id, url);
      return url;
    } catch { return null; }
  })();
}

const thumbs = new Map<string, string>();

export function frameFrom(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.preload = 'metadata';
    const done = (out: string | null) => { v.removeAttribute('src'); resolve(out); };
    v.onloadeddata = () => {
      // a moment in, so we do not catch a black first frame
      v.currentTime = Math.min(0.8, (v.duration || 1) / 3);
    };
    v.onseeked = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 96; c.height = 96;
        const ctx = c.getContext('2d');
        if (!ctx) return done(null);
        const side = Math.min(v.videoWidth, v.videoHeight);
        ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, 96, 96);
        done(c.toDataURL('image/jpeg', 0.7));
      } catch { done(null); }
    };
    v.onerror = () => done(null);
    v.src = src;
  });
}

export const gestureSpec = (key: string) => GESTURES.find((g) => g.key === key);
