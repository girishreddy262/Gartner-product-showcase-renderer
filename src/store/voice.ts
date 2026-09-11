import { update, getState } from './project';
import { playableUrl } from './media';
import { transcribe, signedUrl, uploadFile } from '../lib/api';
import { itemId } from '../lib/id';
import { buildAuto, DEFAULT_AUTO } from './autoScene';
import { autoPinProject, fitFootageToVoice } from './sync';
import { setScreenEvents } from './autoScene';
import { findScreenEvents } from '../lib/screenChange';
import type { Block, Word } from './types';

/** Kept in step with the list in project.ts. */
const FILLER_WORDS = new Set(['uh', 'um', 'erm', 'ah', 'er', 'hmm', 'mm', 'uhh', 'umm']);

type Listener = (s: { busy: string | null; error: string | null; done: number; total: number }) => void;
let state = { busy: null as string | null, error: null as string | null, done: 0, total: 0 };
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l({ ...state }));
export function onVoice(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }
export const getVoiceState = () => state;
const setBusy = (busy: string | null, error: string | null = null, done = 0, total = 0) => {
  state = { busy, error, done, total };
  emit();
};

export interface VoiceOption { voiceId: string; name: string; preview?: string; desc?: string }
let voiceList: VoiceOption[] = [];
export const getVoices = () => voiceList;

export async function loadVoices(): Promise<VoiceOption[]> {
  if (voiceList.length) return voiceList;
  try {
    const r = await fetch('/api/voices');
    const d = await r.json() as { voices?: VoiceOption[] };
    voiceList = d.voices || [];
  } catch { voiceList = []; }
  emit();
  return voiceList;
}

/** One voice for the whole script. A block only carries its own when the user
 *  deliberately overrides it, which is rare. */
/** Give a fresh project a voice as soon as the list arrives, so the picker
 *  shows what will actually be used. */
export function adoptDefaultVoice() {
  const p = getState().project;
  if (p.voiceSettings.voiceId) return;
  const first = getVoices()[0];
  if (first) setProjectVoice(first.voiceId, first.name);
}

export function setProjectVoice(voiceId: string, name: string) {
  // Blocks that follow the project voice are now out of date.
  update((p) => {
    p.blocks.forEach((b) => {
      if (!b.voiceOverride && b.source === 'generated') b.dirty = true;
    });
    return p;
  });
  update((p) => {
    p.voiceSettings = { ...p.voiceSettings, voiceId, voiceName: name };
    // Anything not deliberately overridden follows the script voice.
    p.blocks.forEach((b) => { if (!b.voiceOverride) { b.voiceId = voiceId; b.voiceName = name; b.dirty = true; } });
    return p;
  });
}

/** Roughly a sentence, so blocks read as paragraphs rather than one wall. */
function splitIntoBlocks(words: Word[]): Block[] {
  const out: Block[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({
      id: itemId('b'),
      text: cur.map((w) => w.text).join(' '),
      source: 'recorded',
      words: cur.map((w) => ({ ...w, startMs: w.startMs - cur[0].startMs, endMs: w.endMs - cur[0].startMs })),
      durationMs: Math.max(300, cur[cur.length - 1].endMs - cur[0].startMs),
      dirty: false,
      takes: [],
    });
    cur = [];
  };
  for (let i = 0; i < words.length; i++) {
    cur.push(words[i]);
    const endsSentence = /[.!?]$/.test(words[i].text);
    const bigPause = words[i + 1] && words[i + 1].startMs - words[i].endMs > 700;
    if ((endsSentence && cur.length > 4) || bigPause || cur.length > 40) flush();
  }
  flush();
  return out;
}

/** Transcribe the first video on the timeline and turn it into blocks. */
export async function transcribeProject() {
  const p = getState().project;
  const seg = p.segments[0];
  const asset = seg ? p.media.find((m) => m.id === seg.videoId) : p.media[0];
  if (!asset) { setBusy(null, 'Record or import a video first, then transcribe it.'); return; }
  if (asset.uploadState === 'failed') {
    setBusy(null, `"${asset.name}" never finished uploading: ${asset.uploadError || 'the upload failed'}. Retry it from the Media panel, then transcribe.`);
    return;
  }
  if (asset.url.startsWith('blob:')) {
    const pct = Math.round((asset.uploadPct || 0) * 100);
    setBusy(null, `"${asset.name}" is only in this browser so far (${pct}% uploaded). Transcription reads the stored copy, so wait for it to finish.`);
    return;
  }

  if (!asset.audioKey) {
    setBusy(null, `The audio for "${asset.name}" has not been prepared yet. Re-import the file, or wait for the import to finish.`);
    return;
  }

  setBusy('Transcribing');
  try {
    const url = await signedUrl(asset.audioKey);
    const r = await transcribe(url) as { words?: { text: string; start: number; end: number }[]; text?: string };
    const words: Word[] = (r.words || []).map((w) => ({ text: w.text, startMs: w.start, endMs: w.end }));
    if (!words.length) throw new Error('no speech was found in that recording');
    const blocks = splitIntoBlocks(words);
    update((p2) => {
      p2.blocks = blocks;
      p2.sections = [];

      // Hand each paragraph its own slice of the recording, so cutting words
      // can cut the matching footage. Without this the script and the video
      // drift apart the moment anything is deleted.
      const rec = p2.segments.find((s) => s.kind === 'recording');
      if (rec) {
        const base = rec.sourceStartMs;
        let at = rec.startMs;
        let head = 0;
        p2.segments = [
          ...p2.segments.filter((s) => s.kind !== 'recording'),
          ...blocks.map((b) => {
            const first = b.words![0];
            const last = b.words![b.words!.length - 1];
            const seg = {
              ...rec, id: itemId('sg'), blockId: b.id,
              startMs: at, durationMs: Math.max(40, last.endMs - first.startMs),
              sourceStartMs: base + head + first.startMs,
            };
            at += seg.durationMs;
            return seg;
          }),
        ].sort((x, y) => x.startMs - y.startMs);
        void head;
      }
      return p2;
    });
    // Strike the fillers straight away. Making people find a button to remove
    // their own "uh"s is work the tool should have already done.
    update((p2) => {
      p2.blocks.forEach((b) => {
        (b.words || []).forEach((w) => {
          if (FILLER_WORDS.has(w.text.toLowerCase().replace(/[^a-z]/g, ''))) w.del = true;
        });
        if (b.words) b.text = b.words.filter((w) => !w.del).map((w) => w.text).join(' ');
      });
      return p2;
    });

    autoPinProject();
    setBusy(null);
    void nameSections();
  } catch (e) {
    setBusy(null, String((e as Error).message));
  }
}

/**
 * Sections are derived from what the video covers. Until the assistant is
 * wired, group by the natural pauses the transcript already exposes.
 */
export async function nameSections() {
  const p = getState().project;
  if (!p.blocks.length) return;
  const per = Math.max(2, Math.ceil(p.blocks.length / 4));
  update((p2) => {
    p2.sections = [];
    for (let i = 0; i < p2.blocks.length; i += per) {
      const first = p2.blocks[i].text.split(/\s+/).slice(0, 5).join(' ');
      p2.sections.push({ id: itemId('s'), title: first.replace(/[.,]$/, ''), fromBlock: i });
    }
    return p2;
  }, { history: false });
}

/** Generate speech for one block, or for every dirty block. */
/** The script as the model should receive it: struck words gone, pauses as
 *  breaks. Multilingual v2 honours these; v3 ignores them harmlessly. */
function scriptFor(b: { text: string; words?: { text: string; del?: boolean; pauseAfterMs?: number }[] }) {
  if (!b.words?.length) return b.text;
  let out = '';
  for (const w of b.words) {
    if (!w.del) out += w.text + ' ';
    if (w.pauseAfterMs) out += `<break time="${(w.pauseAfterMs / 1000).toFixed(1)}s" /> `;
  }
  return out.trim() || b.text;
}

export async function generateBlock(blockId: string, quiet = false) {
  const p = getState().project;
  const b = p.blocks.find((x) => x.id === blockId);
  if (!b) return;

  // A block only keeps its own voice when the user deliberately set one.
  // Otherwise it follows the project voice, so changing that actually changes
  // what gets spoken. Sending an undefined id silently used the API default.
  // A new project has no voice yet, so fall back to the first available one
  // rather than refusing to generate anything at all.
  const voiceId = (b.voiceOverride && b.voiceId) ? b.voiceId : (p.voiceSettings.voiceId || getVoices()[0]?.voiceId);
  if (!voiceId) {
    setBusy(null, 'No voices are available. Check the voice service.');
    return;
  }

  // Struck words are already out of b.text. Pauses are added as breaks the
  // model understands.
  const text = scriptFor(b);

  if (!quiet) setBusy('Generating');
  try {
    const r = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Block settings win where set; anything left undefined follows the
      // project, so one slider does not have to be set 40 times.
      body: JSON.stringify({ text, voiceId, model: 'v2', voice_settings: (() => {
        const s = { ...p.voiceSettings, ...(b.settings || {}) };
        return {
          stability: s.stability === 'robust' ? 0.85 : s.stability === 'creative' ? 0.3 : 0.5,
          similarity_boost: s.similarity,
          style: s.style,
          speed: s.speed,
          use_speaker_boost: s.speakerBoost,
        };
      })() }),
    });
    if (!r.ok) {
      const t = await r.text();
      // Turn a service reply into something a person can act on.
      try {
        const d = JSON.parse(t) as { code?: string; error?: string; metric?: string };
        if (d.code === 'quota_exceeded') {
          throw new Error('You have used up the voice allowance on this plan.');
        }
        if (d.code === 'read_only') throw new Error('You have view-only access to this workspace.');
        if (d.code === 'unauthenticated') throw new Error('Your session expired. Reload to sign in again.');
        throw new Error(d.error || `voice generation failed (${r.status})`);
      } catch (parsed) {
        if (parsed instanceof Error && !/^\{/.test(parsed.message)) throw parsed;
        throw new Error(`voice generation failed (${r.status})`);
      }
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const durationMs = await audioDuration(url);

    /*
     * Store the narration as well as holding it locally.
     *
     * The blob plays fine in this browser and nowhere else. Lip-sync needs a
     * URL the provider can fetch, export needs one the renderer can fetch, and
     * reopening the project needs one that outlives the tab. Without this the
     * audio existed only until the page closed.
     */
    let storedKey: string | null = null;
    try {
      const file = new File([blob], `vo_${blockId}_${Date.now()}.mp3`, { type: blob.type || 'audio/mpeg' });
      storedKey = (await uploadFile(file)).key;
    } catch {
      // Not fatal: playback still works from the blob, and the audio can be
      // stored on the next generation.
    }

    update((p2) => {
      const bb = p2.blocks.find((x) => x.id === blockId);
      if (!bb) return p2;
      bb.audioUrl = url;
      // The durable copy, for anything outside this browser tab.
      bb.audioKey = storedKey || undefined;
      bb.source = 'generated';
      // Mute the footage this paragraph came from, or both voices play.
      p2.segments.forEach((s) => { if (s.blockId === bb.id) s.muteSourceAudio = true; });
      bb.voiceId = voiceId;
      bb.voiceName = getVoices().find((x) => x.voiceId === voiceId)?.name || bb.voiceName;
      bb.dirty = false;
      bb.durationMs = durationMs;
      bb.takes = [{ at: Date.now(), url }, ...bb.takes].slice(0, 6);
      return p2;
    });
    setBusy(null);
  } catch (e) {
    setBusy(null, String((e as Error).message));
  }
}

/**
 * Generate the whole script in one action. Asking someone to press a button per
 * paragraph is the wrong shape for a forty-block transcript.
 */
export async function generateAll(onlyChanged = true) {
  // A recorded paragraph still needs a voice: that is the whole point of
  // pressing Generate speech on a transcript. Convert them first, rather than
  // skipping them and then claiming everything is up to date.
  const toConvert = getState().project.blocks.filter((b) => b.source === 'recorded');
  if (toConvert.length) {
    const p0 = getState().project;
    update((p) => {
      p.blocks.forEach((b) => {
        if (b.source !== 'recorded') return;
        b.source = 'generated';
        b.overRecording = true;
        b.dirty = true;
        if (!b.voiceOverride) { b.voiceId = p0.voiceSettings.voiceId; b.voiceName = p0.voiceSettings.voiceName; }
      });
      // The original audio must not play underneath the new voice.
      p.segments.forEach((s) => { if (s.blockId) s.muteSourceAudio = true; });
      return p;
    });
  }

  const blocks = getState().project.blocks.filter((b) =>
    onlyChanged ? (b.dirty || !b.audioUrl) : true
  );
  if (!blocks.length) { setBusy(null); return; }

  for (let i = 0; i < blocks.length; i++) {
    // The button fills as a progress bar, so the label stays plain English.
    setBusy('Generating speech', null, i, blocks.length);
    await generateBlock(blocks[i].id, true);
    if (getVoiceState().error) return;  // stop on the first real failure
  }

  // The voice is a different length from the speech it replaced, so refit the
  // footage before anything else reads the durations.
  setBusy('Matching the video to the voice');
  fitFootageToVoice();

  // Durations are only final once every block has its audio, so the on-screen
  // treatment is built here rather than per block.
  if (autoScenesOn()) {
    // Find real screen events first. Without them no zoom is placed, which is
    // the point: a zoom every few paragraphs is a pattern, not a decision.
    try {
      const p2 = getState().project;
      const asset = p2.media.find((m) => m.kind === 'video' && m.url);
      if (asset) {
        setBusy('Looking for moments worth zooming into');
        const url = await playableUrl(asset);
        const evts = await findScreenEvents(url, { maxMs: 20 * 60 * 1000 });
        setScreenEvents(evts);
      }
    } catch {
      setScreenEvents([]);  // no scan, no zooms; chapters still land
    }
    setBusy('Adding chapters and callouts');
    buildAuto(DEFAULT_AUTO);
  }
  setBusy(null);
}

const AUTO_KEY = 'fde.autoScenes';

/** On by default; a preference rather than a setting buried in a dialog. */
export function autoScenesOn() {
  try { return localStorage.getItem(AUTO_KEY) !== 'off'; } catch { return true; }
}

export function setAutoScenes(on: boolean) {
  try { localStorage.setItem(AUTO_KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
}

function audioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? Math.round(a.duration * 1000) : 3000);
    a.onerror = () => resolve(3000);
    a.src = url;
  });
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__fdeVoice = { transcribeProject, generateBlock, generateAll, getVoiceState, loadVoices, setProjectVoice };
}

export interface CleanResult { configured: boolean; text: string | null }

/**
 * Tidy a script with the language model on the voice worker. Returns
 * configured:false when no model key is set, so the caller can say so plainly
 * rather than appearing to succeed while changing nothing.
 */
export async function cleanText(text: string): Promise<CleanResult> {
  const r = await fetch('/api/clean', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error(`rewrite failed (${r.status})`);
  const d = await r.json() as { configured?: boolean; text?: string | null; segments?: { text: string }[] | null };
  const out = d.text ?? d.segments?.map((s) => s.text).join('\n\n') ?? null;
  return { configured: !!d.configured, text: out };
}
