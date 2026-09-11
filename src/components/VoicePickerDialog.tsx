import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getVoices, loadVoices } from '../store/voice';
import { Icon } from './Icon';

/** A voice as the picker needs it: the name splits into a person and the
 *  descriptors ElevenLabs bakes into it, and desc carries gender, accent
 *  and tone as a middot-separated string. */
export interface PickVoice {
  voiceId: string; name: string; preview?: string; desc?: string;
}

const person = (name: string) => name.split(/\s+[-–—]\s+/)[0].trim();

/** A stable colour per voice, so the same person looks the same each time. */
const hue = (id: string) => {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return [212, 268, 154, 24, 330, 190][n % 6];
};
const traits = (v: PickVoice) => {
  const fromDesc = (v.desc || '').split('·').map((s) => s.trim()).filter(Boolean);
  const fromName = (v.name.split(/\s+[-–—]\s+/)[1] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...fromDesc, ...fromName];
};

const GENDERS = ['male', 'female'];

/**
 * A short default list. Eighty-five voices is a scroll, not a choice, so the
 * picker opens on a spread that covers the usual needs and hides the rest
 * behind Browse all. Matched on the person's name, since ElevenLabs appends
 * descriptors that change.
 */
const SHORTLIST = [
  'Sarah', 'Roger', 'Laura', 'Charlie', 'George', 'Callum', 'River', 'Liam',
  'Charlotte', 'Alice', 'Matilda', 'Will', 'Jessica', 'Eric', 'Chris', 'Brian',
  'Daniel', 'Lily', 'Bill', 'Aria',
];

export const VoicePickerDialog: React.FC<{
  currentId?: string;
  title?: string;
  /** Show the apply-to-all choice. Off for a mid-script voice change, where
   *  applying everywhere would defeat the point. */
  offerAll?: boolean;
  onPick: (v: PickVoice, applyToAll: boolean) => void;
  onClose: () => void;
}> = ({ currentId, title = 'Choose a voice', offerAll = false, onPick, onClose }) => {
  const [voices, setVoices] = useState<PickVoice[]>(getVoices() as PickVoice[]);
  const [q, setQ] = useState('');
  const [gender, setGender] = useState<string>('any');
  const [accent, setAccent] = useState<string>('any');
  const [playing, setPlaying] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  // Changing the voice usually means changing it everywhere, so this starts on.
  const [applyAll, setApplyAll] = useState(true);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { void loadVoices().then(() => setVoices(getVoices() as PickVoice[])); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); audio.current?.pause(); };
  }, [onClose]);

  // Accents come from the data rather than a fixed list, so this stays right
  // as ElevenLabs adds voices.
  const accents = useMemo(() => {
    const s = new Set<string>();
    voices.forEach((v) => traits(v).forEach((raw) => {
      const t = raw.toLowerCase();
      if (!GENDERS.includes(t) && /^[a-z\- ]+$/.test(t) && t.length < 16) s.add(t);
    }));
    return [...s].sort().slice(0, 24);
  }, [voices]);

  const curated = voices.filter((v) => SHORTLIST.includes(person(v.name)));
  // Only offer the short list when it actually matched something.
  const useShortlist = !all && curated.length >= 6;
  const pool = useShortlist ? curated : voices;
  const filtering = q.trim() !== '' || gender !== 'any' || accent !== 'any';

  const shown = (filtering ? voices : pool).filter((v) => {
    // Match whole traits, not substrings: "male" is inside "female".
    const t = traits(v).map((x) => x.toLowerCase());
    if (gender !== 'any' && !t.includes(gender)) return false;
    if (accent !== 'any' && !t.includes(accent)) return false;
    if (q && !`${v.name} ${t.join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const preview = (v: PickVoice) => {
    audio.current?.pause();
    if (playing === v.voiceId) { setPlaying(null); return; }
    if (!v.preview) return;
    const a = new Audio(v.preview);
    audio.current = a;
    a.onended = () => setPlaying(null);
    void a.play().then(() => setPlaying(v.voiceId)).catch(() => setPlaying(null));
  };

  return (
    <div className="dlg-scrim" onMouseDown={onClose}>
      <div className="dlg dlg-640" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="dlg-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon n="x" s={15} /></button>
        </div>

        <div className="vp-filters">
          <input
            className="inp" placeholder="Search voices" value={q}
            onChange={(e) => setQ(e.target.value)} autoFocus
          />
          <select className="inp" value={gender} onChange={(e) => setGender(e.target.value)} aria-label="Gender">
            <option value="any">Any gender</option>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className="inp" value={accent} onChange={(e) => setAccent(e.target.value)} aria-label="Accent or tone">
            <option value="any">Any accent</option>
            {accents.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <ul className="vp-list">
          {shown.map((v) => (
            <li key={v.voiceId} className={v.voiceId === currentId ? 'on' : undefined}>
              <button
                className="vp-av"
                onClick={() => preview(v)}
                aria-label={`Preview ${person(v.name)}`}
                disabled={!v.preview}
                style={{ background: `hsl(${hue(v.voiceId)} 45% 26%)` }}
              >
                <span className="vp-init">{person(v.name).slice(0, 1)}</span>
                <span className="vp-hover"><Icon n={playing === v.voiceId ? 'pause' : 'play'} s={13} /></span>
              </button>

              <span className="vp-meta">
                <b>{person(v.name)}</b>
                <span className="vp-traits">
                  {traits(v).slice(0, 4).map((t) => <em key={t}>{t.replace(/_/g, ' ')}</em>)}
                </span>
              </span>

              <button
                className={v.voiceId === currentId ? 'vp-use on' : 'vp-use'}
                onClick={() => { audio.current?.pause(); onPick(v, offerAll ? applyAll : false); }}
              >
                {v.voiceId === currentId ? 'Selected' : 'Use'}
              </button>
            </li>
          ))}
          {!shown.length && <li className="vp-none"><span className="hint">No voices match those filters.</span></li>}
        </ul>

        {offerAll && (
          <label className="applyall">
            <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
            <span>Use this voice for the whole video</span>
          </label>
        )}

        <p className="dlg-foot">
          <span className="hint">
            {useShortlist && !filtering
              ? `${shown.length} popular voices`
              : `${shown.length} of ${voices.length} voices`}
          </span>
          <span className="spacer" />
          {!filtering && (useShortlist || all) && curated.length >= 6 && (
            <button className="act" onClick={() => setAll((v) => !v)}>
              {all ? 'Show popular only' : `Browse all ${voices.length}`}
            </button>
          )}
        </p>
      </div>
    </div>
  );
};
