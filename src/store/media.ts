import { update, getState, addItem } from './project';
import { uploadFile, signedUrl, probeVideo } from '../lib/api';
import { extractAudio } from '../lib/audio';
import { itemId } from '../lib/id';
import type { MediaAsset } from './types';

/** Signed URLs expire, so keep them out of the project and cache them here. */
const urlCache = new Map<string, { url: string; at: number }>();
const URL_TTL_MS = 5 * 60 * 60 * 1000;

export async function playableUrl(asset: MediaAsset): Promise<string> {
  // A file that never finished uploading has no key. Asking S3 to sign an
  // empty string just produces a 400 and an empty canvas.
  if (!asset.url) throw new Error(`"${asset.name}" was never uploaded`);
  // An absolute URL is already playable. Anything else is a storage key that
  // has to be signed. Treating a provider's https URL as a key produced a
  // signed link to nothing, which plays as a black frame.
  if (/^https?:\/\//.test(asset.url)) return asset.url;
  const hit = urlCache.get(asset.id);
  if (hit && Date.now() - hit.at < URL_TTL_MS) return hit.url;
  const url = asset.url.startsWith('blob:') ? asset.url : await signedUrl(asset.url);
  urlCache.set(asset.id, { url, at: Date.now() });
  return url;
}

/** Remove a file and every clip that used it, so nothing points at a ghost. */
export function removeMedia(assetId: string) {
  update((p) => {
    p.media = p.media.filter((m) => m.id !== assetId);
    p.segments = p.segments.filter((s) => s.videoId !== assetId);
    p.camera = p.camera.filter((s) => s.videoId !== assetId);
    p.voice = p.voice.filter((a) => a.audioId !== assetId);
    p.music = p.music.filter((a) => a.audioId !== assetId);
    return p;
  });
  urlCache.delete(assetId);
  pending.delete(assetId);
}

/** Clear out everything that failed to upload, in one action. */
export function removeFailedMedia() {
  const dead = getState().project.media.filter((m) => !m.url || m.uploadState === 'failed');
  dead.forEach((m) => removeMedia(m.id));
  return dead.length;
}

export interface ImportState { name: string; pct: number; error?: string; stage?: string }
type Listener = (s: ImportState[]) => void;
let imports: ImportState[] = [];
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l([...imports]));
export function onImports(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }
export const getImports = () => imports;

/**
 * Import files. The local blob URL is used immediately so the clip is playable
 * before the upload finishes; the S3 key replaces it once stored, which is what
 * makes an asset permanent and a render possible.
 */
/** Files kept in memory so a failed upload can be retried in place. */
const pending = new Map<string, File>();

export function dismissImports() { imports = []; emit(); }

/** Retry a single failed upload without re-picking the file. */
export async function retryUpload(assetId: string) {
  const file = pending.get(assetId);
  if (!file) return;
  update((p) => {
    const m = p.media.find((x) => x.id === assetId);
    if (m) { m.uploadState = 'uploading'; m.uploadPct = 0; m.uploadError = undefined; }
    return p;
  }, { history: false });
  try {
    const { key } = await uploadFile(file, (pct) => {
      update((p) => { const m = p.media.find((x) => x.id === assetId); if (m) m.uploadPct = pct; return p; }, { history: false });
    });
    update((p) => {
      const m = p.media.find((x) => x.id === assetId);
      if (m) { m.url = key; m.uploadState = 'stored'; m.uploadPct = 1; m.uploadError = undefined; }
      return p;
    }, { history: false });
    pending.delete(assetId);
  } catch (e) {
    update((p) => {
      const m = p.media.find((x) => x.id === assetId);
      if (m) { m.uploadState = 'failed'; m.uploadError = String((e as Error).message); }
      return p;
    }, { history: false });
  }
}

export async function importFiles(files: File[]) {
  const videos = files.filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(f.name));
  const audios = files.filter((f) => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac)$/i.test(f.name));
  const chosen = [...videos, ...audios];
  if (!chosen.length) return;

  imports = chosen.map((f) => ({ name: f.name, pct: 0 }));
  emit();

  for (let i = 0; i < chosen.length; i++) {
    const file = chosen[i];
    const isVideo = videos.includes(file);
    try {
      // A probe can fail on an exotic codec or a damaged file. That must not
      // lose the import: fall back to a nominal duration, keep the file, and
      // let the user see it rather than silently dropping it.
      let meta = { durationMs: 10000, width: 1920, height: 1080 };
      let probeFailed = false;
      if (isVideo) {
        try { meta = await probeVideo(file); }
        catch { probeFailed = true; }
      } else {
        meta = { durationMs: 10000, width: 0, height: 0 };
      }

      const blobUrl = URL.createObjectURL(file);
      const id = itemId(isVideo ? 'vid' : 'aud');

      // On the timeline immediately, playable from the local blob.
      update((p) => {
        p.media.push({
          id, kind: isVideo ? 'video' : 'audio', url: blobUrl,
          name: file.name, durationMs: meta.durationMs,
          width: meta.width, height: meta.height,
          uploadState: 'uploading', uploadPct: 0,
        });
        return p;
      });
      urlCache.set(id, { url: blobUrl, at: Date.now() });

      if (isVideo) {
        const end = getState().project.segments.reduce((m, s) => Math.max(m, s.startMs + s.durationMs), 0);
        addItem('segments', {
          id: itemId('sg'), kind: 'recording', videoId: id,
          startMs: end, durationMs: meta.durationMs, sourceStartMs: 0,
          speed: 1, muteSourceAudio: false,
        });
      }

      // Keep the file object so a failed upload can be retried without
      // asking the user to pick it again.
      pending.set(id, file);

      const { key } = await uploadFile(file, (pct) => {
        imports = imports.map((im, ix) => (ix === i ? { ...im, pct } : im));
        emit();
        update((p) => {
          const m = p.media.find((x) => x.id === id);
          if (m) m.uploadPct = pct;
          return p;
        }, { history: false });
      });

      // Swap the blob for the durable key now that it is stored.
      update((p) => {
        const m = p.media.find((x) => x.id === id);
        if (m) { m.url = key; m.uploadState = 'stored'; m.uploadPct = 1; m.uploadError = undefined; }
        return p;
      }, { history: false });
      pending.delete(id);

      // Extract and store the audio too. Transcription reads this rather than
      // the video, which is what makes long recordings possible at all.
      if (isVideo) {
        imports = imports.map((im, ix) => (ix === i ? { ...im, pct: 1, stage: 'Preparing audio' } : im));
        emit();
        try {
          const { blob } = await extractAudio(file);
          const audio = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.wav', { type: 'audio/wav' });
          const a = await uploadFile(audio);
          update((p) => {
            const m = p.media.find((x) => x.id === id);
            if (m) m.audioKey = a.key;
            return p;
          }, { history: false });
        } catch {
          // Not fatal: the video is stored and playable, transcription will
          // simply say it needs the audio.
        }
      }

      imports = imports.map((im, ix) => (ix === i
        ? { ...im, pct: 1, error: probeFailed ? 'imported, but the length could not be read' : undefined }
        : im));
      emit();
    } catch (e) {
      const msg = String((e as Error).message);
      imports = imports.map((im, ix) => (ix === i ? { ...im, error: msg } : im));
      emit();
      update((p) => {
        const m = p.media.find((x) => x.name === file.name && x.uploadState !== 'stored');
        if (m) { m.uploadState = 'failed'; m.uploadError = msg; }
        return p;
      }, { history: false });
    }
  }

  // Successes clear themselves; a failure stays on screen until dismissed,
  // because a toast that vanishes is how a broken upload looks like a working one.
  const anyFailed = imports.some((im) => im.error);
  if (!anyFailed) setTimeout(() => { imports = []; emit(); }, 1500);
}

/**
 * Bring a finished recording in. The screen take becomes the main picture and
 * the camera take a parallel segment on its own lane, both starting at the same
 * point so they stay in sync.
 */
export async function importRecording(files: { screen?: File; camera?: File; durationMs?: number }) {
  const startAt = getState().project.segments.reduce((m, s) => Math.max(m, s.startMs + s.durationMs), 0);
  const added: { id: string; file: File; kind: 'screen' | 'camera' }[] = [];

  for (const kind of ['screen', 'camera'] as const) {
    const file = files[kind];
    if (!file) continue;
    // The recorder measured the real length; the probe only supplies size.
    let meta = { durationMs: files.durationMs || 10000, width: 1280, height: 720 };
    try {
      const probed = await probeVideo(file);
      meta = { ...probed, durationMs: files.durationMs || probed.durationMs };
    } catch { /* keep the measured length */ }
    if (!Number.isFinite(meta.durationMs) || meta.durationMs <= 0) meta.durationMs = files.durationMs || 10000;
    const blobUrl = URL.createObjectURL(file);
    const id = itemId(kind === 'screen' ? 'vid' : 'cam');

    update((p) => {
      p.media.push({ id, kind: 'video', url: blobUrl, name: file.name, durationMs: meta.durationMs, width: meta.width, height: meta.height });
      return p;
    });
    urlCache.set(id, { url: blobUrl, at: Date.now() });

    if (kind === 'screen') {
      addItem('segments', {
        id: itemId('sg'), kind: 'recording', videoId: id,
        startMs: startAt, durationMs: meta.durationMs, sourceStartMs: 0,
        speed: 1, muteSourceAudio: false,
      });
    } else {
      const soloCam = !files.screen;
      addItem(soloCam ? 'segments' : 'camera', {
        id: itemId(soloCam ? 'sg' : 'cam'),
        kind: soloCam ? 'recording' : 'camera',
        videoId: id, startMs: startAt, durationMs: meta.durationMs, sourceStartMs: 0,
        speed: 1, muteSourceAudio: false,
        ...(soloCam ? {} : { x: 1480, y: 700, size: 320, shape: 'circle' as const }),
      });
    }
    added.push({ id, file, kind });
  }

  // Upload in the background; the takes are already playable from blobs.
  imports = added.map((a) => ({ name: a.file.name, pct: 0 }));
  emit();
  for (let i = 0; i < added.length; i++) {
    try {
      const { key } = await uploadFile(added[i].file, (pct) => {
        imports = imports.map((im, ix) => (ix === i ? { ...im, pct } : im));
        emit();
      });
      update((p) => {
        const m = p.media.find((x) => x.id === added[i].id);
        if (m) m.url = key;
        return p;
      }, { history: false });
    } catch (e) {
      imports = imports.map((im, ix) => (ix === i ? { ...im, error: String((e as Error).message) } : im));
      emit();
    }
  }
  setTimeout(() => { imports = []; emit(); }, 1500);
}
