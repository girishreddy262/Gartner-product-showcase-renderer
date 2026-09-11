import { update, getState, addItem } from './project';
import { signedUrl } from '../lib/api';
import { itemId } from '../lib/id';
import { getAvatar } from './avatars';
import { GESTURES } from './types';

type Listener = (s: JobState[]) => void;
export interface JobState { blockId: string; label: string; pct: number; queue?: number | null; error?: string }
let jobs: JobState[] = [];
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l([...jobs]));
export function onAvatarJobs(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }
export const getAvatarJobs = () => jobs;

/**
 * Which gesture a section uses. Auto is the sensible default: welcome the
 * viewer at the start, sign off at the end, talk in between. The clip is
 * looped or trimmed to the audio, so length never has to match.
 */
/**
 * Choose the gesture from what the paragraph actually says, so nobody has to
 * pick one forty times. The opening and closing lines get a welcome; a line
 * that points at the screen gets pointing; a line explaining how something
 * works gets explaining; everything else talks.
 */
const POINTS = /\b(click|select|here|top right|top left|this button|the menu|notice|look at|you can see|over here|the icon|the tab)\b/i;
const EXPLAINS = /\b(because|which means|the way|this works|in other words|so that|the reason|essentially|basically)\b/i;

export function autoGesture(blockIndex: number, total: number, text = ''): string {
  if (blockIndex === 0 || blockIndex === total - 1) return 'welcoming';
  if (POINTS.test(text)) return 'pointing';
  if (EXPLAINS.test(text)) return 'explaining';
  return 'talking';
}

/** fal bills per second of OUTPUT, and output length equals the narration. */
export const AVATAR_RATE_PER_SEC = 0.005;

export function avatarCostFor(ms: number) {
  return (ms / 1000) * AVATAR_RATE_PER_SEC;
}

/** How much avatar video this project already has, in ms. */
export function avatarMinutesUsed() {
  return getState().project.camera.reduce((n, c) => n + c.durationMs, 0);
}

/**
 * Deliver the WHOLE script with one avatar. Choosing a gesture per paragraph
 * forty times is not a workflow, it is a chore.
 */
export async function generateAllAvatarClips(
  avatarId: string,
  opts: { capMs?: number; onSkip?: (why: string) => void } = {}
) {
  const blocks = getState().project.blocks;
  const eligible = blocks.filter((b) => b.audioUrl || b.audioKey);
  if (!eligible.length) {
    opts.onSkip?.('Generate the speech first, then the avatar can speak it.');
    return { made: 0, skipped: 0, ms: 0 };
  }

  const cap = opts.capMs ?? Infinity;
  let used = avatarMinutesUsed();
  let made = 0;
  let skipped = 0;

  for (const b of eligible) {
    if (used + b.durationMs > cap) { skipped++; continue; }
    const idx = blocks.findIndex((x) => x.id === b.id);
    await generateAvatarClip(b.id, avatarId, autoGesture(idx, blocks.length, b.text));
    used += b.durationMs;
    made++;
  }
  return { made, skipped, ms: used };
}

export const GESTURE_CHOICES = GESTURES.filter((g) => g.key !== 'consent').map((g) => ({ key: g.key, label: g.label }));

/**
 * Lip-sync one block: take the avatar's gesture clip and the block's generated
 * narration, and produce a video of that face speaking those words.
 */
export async function generateAvatarClip(blockId: string, avatarId: string, gesture?: string) {
  const st = getState();
  const p = st.project;
  const idx = p.blocks.findIndex((b) => b.id === blockId);
  const block = p.blocks[idx];
  const avatar = getAvatar(avatarId);
  if (!block || !avatar) return;

  // Either form counts: a local blob from this session, or a stored copy.
  if (!block.audioUrl && !block.audioKey) {
    push({ blockId, label: block.text.slice(0, 28), pct: 0, error: 'Generate the voice for this block first.' });
    return;
  }
  const want = gesture || autoGesture(idx, p.blocks.length, block.text);
  const clip = avatar.clips.find((c) => c.gesture === want)
    || avatar.clips.find((c) => c.gesture === 'talking')
    || avatar.clips.find((c) => c.gesture === 'idle');
  if (!clip) {
    push({ blockId, label: block.text.slice(0, 28), pct: 0, error: 'That avatar has no usable clip yet.' });
    return;
  }
  if (clip.url.startsWith('blob:')) {
    push({ blockId, label: block.text.slice(0, 28), pct: 0, error: 'The avatar is still uploading.' });
    return;
  }

  push({ blockId, label: block.text.slice(0, 28), pct: 0.05 });

  try {
    const videoUrl = await signedUrl(clip.url);
    // Generated narration lives as a blob until it is stored; the provider
    // needs a URL it can fetch, so a local-only take cannot be sent.
    // Prefer the stored copy: a blob URL exists only inside this browser, so
    // the provider cannot fetch it.
    const audioUrl = block.audioKey
      ? await signedUrl(block.audioKey)
      : (block.audioUrl || '').startsWith('blob:')
      ? (() => { throw new Error('The narration has not finished storing yet. Generate the speech again, then retry.'); })()
      : await signedUrl(block.audioUrl as string);

    const r = await fetch('/api/lipsync', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      // The allowance is reserved from this, so it has to be the real length.
      body: JSON.stringify({ videoUrl, audioUrl, seconds: Math.ceil(block.durationMs / 1000) }),
    });
    const raw = await r.text();
    let d: {
      jobId?: string; error?: string; code?: string; used?: number; allowed?: number;
      statusUrl?: string | null; resultUrl?: string | null;
    };
    try { d = JSON.parse(raw); }
    catch { throw new Error(`the lip-sync service is unavailable (${r.status})`); }

    // Say how much is left, not just that there is none.
    if (d.code === 'quota_exceeded') {
      const left = Math.max(0, (d.allowed ?? 0) - (d.used ?? 0));
      throw new Error(
        `Avatar allowance used up: ${Math.round((d.used ?? 0) / 60)} of ${Math.round((d.allowed ?? 0) / 60)} minutes.`
        + (left ? ` ${left}s left.` : ' Raise the limit for this workspace to continue.')
      );
    }
    if (d.code === 'seconds_required') throw new Error('This paragraph has no narration length yet.');
    if (d.error || !d.jobId) throw new Error(d.error || 'the job did not start');

    const url = await poll(d.jobId, blockId, block.text.slice(0, 28), { statusUrl: d.statusUrl, resultUrl: d.resultUrl });
    if (!url) return;

    // Land it on the camera lane, aligned to where the block plays.
    const startMs = p.blocks.slice(0, idx).reduce((n, b) => n + b.durationMs, 0);
    const mediaId = itemId('avm');
    update((pp) => {
      pp.media.push({ id: mediaId, kind: 'video', url, name: `${avatar.name} · ${want}`, durationMs: block.durationMs, width: 1280, height: 720 });
      return pp;
    }, { history: false });
    addItem('camera', {
      id: itemId('cam'), kind: 'camera', videoId: mediaId,
      startMs, durationMs: block.durationMs, sourceStartMs: 0,
      speed: 1, muteSourceAudio: true,
      x: 1480, y: 700, size: 320, shape: 'circle',
    });
    clear(blockId);
  } catch (e) {
    push({ blockId, label: block.text.slice(0, 28), pct: 0, error: String((e as Error).message) });
  }
}

async function poll(
  jobId: string, blockId: string, label: string,
  urls: { statusUrl?: string | null; resultUrl?: string | null } = {}
): Promise<string | null> {
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    // Pass fal's own status and result URLs through, so polling does not
    // depend on rebuilding a path by hand.
    const extra = [
      urls.statusUrl ? `&statusUrl=${encodeURIComponent(urls.statusUrl)}` : '',
      urls.resultUrl ? `&resultUrl=${encodeURIComponent(urls.resultUrl)}` : '',
    ].join('');
    const r = await fetch(`/api/lipsync-status?id=${encodeURIComponent(jobId)}${extra}`);
    const raw = await r.text();
    let d: { done?: boolean; failed?: boolean; progress?: number; url?: string; error?: string; queueDepth?: number | null };
    try { d = JSON.parse(raw); } catch { throw new Error('the lip-sync service replied unexpectedly'); }
    if (d.failed) throw new Error(d.error || 'the lip-sync job failed');
    if (d.done) return d.url || null;
    push({ blockId, label, pct: d.progress ?? 0.3, queue: d.queueDepth ?? null });
  }
  throw new Error('the lip-sync job took too long');
}

function push(j: JobState) {
  jobs = [...jobs.filter((x) => x.blockId !== j.blockId), j];
  emit();
}
function clear(blockId: string) {
  jobs = jobs.filter((x) => x.blockId !== blockId);
  emit();
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__fdeAvatarClips = { generateAvatarClip, autoGesture, getAvatarJobs };
}
