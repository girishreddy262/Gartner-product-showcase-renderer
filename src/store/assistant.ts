import { getState } from './project';
import {
  removeFillers, fillerCount, trimGaps, gapCount, gapSavingMs,
  restoreAll, markWords, setBlockVoiceOverride,
} from './project';
import { generateAll, setProjectVoice, getVoices } from './voice';
import { buildAuto, clearAuto } from './autoScene';

/**
 * Editing by description.
 *
 * Every action here already exists as a store function, so the assistant is a
 * way of reaching them rather than a second implementation. Each returns what
 * it did in plain words, because an edit nobody can see is worse than none.
 */

export interface Action {
  /** What matched, for the reply. */
  did: string;
}

type Handler = (m: RegExpMatchArray, text: string) => Action | null;

const rules: { re: RegExp; run: Handler }[] = [
  {
    re: /\b(remove|delete|strip|cut|get rid of)\b.*\b(filler|um|uh|hesitation)/i,
    run: () => {
      const blocks = getState().project.blocks;
      let n = 0;
      blocks.forEach((b) => { if (b.words?.length) n += removeFillers(b.id); });
      return { did: n ? `Removed ${n} filler word${n === 1 ? '' : 's'}.` : 'There were no filler words to remove.' };
    },
  },
  {
    re: /\b(tighten|shorten|remove|cut)\b.*\b(pause|silence|dead air|gap)/i,
    run: () => {
      const blocks = getState().project.blocks;
      let n = 0;
      let saved = 0;
      blocks.forEach((b) => {
        if (!b.words?.length) return;
        saved += gapSavingMs(b);
        n += trimGaps(b.id);
      });
      return { did: n ? `Tightened ${n} pause${n === 1 ? '' : 's'}, saving about ${(saved / 1000).toFixed(1)}s.` : 'There were no long pauses.' };
    },
  },
  {
    re: /\b(restore|undo|put back|bring back)\b.*\b(word|deletion|cut)/i,
    run: () => {
      const blocks = getState().project.blocks;
      blocks.forEach((b) => { if (b.words?.length) restoreAll(b.id); });
      return { did: 'Put every removed word back.' };
    },
  },
  {
    re: /\b(use|switch to|change to|set)\b.*\bvoice\b/i,
    run: (_m, text) => {
      const voices = getVoices();
      const hit = voices.find((v) => new RegExp(`\\b${v.name.split(/\s+[-–—]\s+/)[0]}\\b`, 'i').test(text));
      if (!hit) {
        return { did: `I could not tell which voice. Available: ${voices.slice(0, 6).map((v) => v.name.split(/\s+[-–—]\s+/)[0]).join(', ')}.` };
      }
      setProjectVoice(hit.voiceId, hit.name);
      return { did: `Switched the whole script to ${hit.name.split(/\s+[-–—]\s+/)[0]}. Generate speech to hear it.` };
    },
  },
  {
    re: /\b(generate|make|create|redo|regenerate)\b.*\b(speech|voice ?over|narration|audio)/i,
    run: () => {
      void generateAll(true);
      return { did: 'Generating the speech now.' };
    },
  },
  {
    re: /\b(add|put|place)\b.*\b(zoom|chapter|spotlight|callout|scene)/i,
    run: () => {
      const r = buildAuto({ chapters: true, zooms: true, spotlights: true });
      return { did: `Added ${r.chapters} chapter title${r.chapters === 1 ? '' : 's'}, ${r.zooms} zoom${r.zooms === 1 ? '' : 's'} and ${r.spotlights} spotlight${r.spotlights === 1 ? '' : 's'}.` };
    },
  },
  {
    re: /\b(remove|clear|delete)\b.*\b(zoom|chapter|spotlight|scene|effect)/i,
    run: () => { clearAuto(); return { did: 'Cleared everything that was added automatically.' }; },
  },
  {
    re: /\b(how long|duration|length)\b/i,
    run: () => {
      const p = getState().project;
      const ms = p.blocks.reduce((n, b) => n + b.durationMs, 0);
      return { did: `The script runs about ${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s across ${p.blocks.length} paragraphs.` };
    },
  },
];

/** What the assistant can do, for when nothing matches. */
export const CAPABILITIES = [
  'remove the filler words',
  'tighten the pauses',
  'use the Roger voice',
  'generate the speech',
  'add zooms and chapters',
  'how long is this',
];

export function ask(text: string): string {
  for (const r of rules) {
    const m = text.match(r.re);
    if (!m) continue;
    try {
      const out = r.run(m, text);
      if (out) return out.did;
    } catch (e) {
      return `That did not work: ${(e as Error).message}`;
    }
  }
  return `I can do these so far:\n${CAPABILITIES.map((c) => `\u2022 ${c}`).join('\n')}`;
}

/** Kept so the panel can offer them as starting points. */
export { markWords, fillerCount, gapCount, setBlockVoiceOverride };
