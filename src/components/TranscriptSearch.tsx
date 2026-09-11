import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, update, seek } from '../store/project';
import { Icon } from './Icon';

interface Hit { blockId: string; wordIndex: number; startMs: number }

/** Find and replace across the script. Replacing keeps the word's timing, so
 *  the video stays in sync: only the text the voice will say changes. */
export const TranscriptSearch: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const blocks = useStore((s) => s.project.blocks);
  const [q, setQ] = useState('');
  const [rep, setRep] = useState('');
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  // Block start times, so jumping to a hit moves the video to the right place.
  const startOf = useMemo(() => {
    const m = new Map<string, number>();
    let t = 0;
    blocks.forEach((b) => { m.set(b.id, t); t += b.durationMs; });
    return m;
  }, [blocks]);

  const hits: Hit[] = useMemo(() => {
    if (!q.trim()) return [];
    const needle = q.toLowerCase();
    const out: Hit[] = [];
    blocks.forEach((b) => {
      (b.words || []).forEach((w, i) => {
        if (!w.del && w.text.toLowerCase().includes(needle)) {
          out.push({ blockId: b.id, wordIndex: i, startMs: (startOf.get(b.id) || 0) + w.startMs });
        }
      });
    });
    return out;
  }, [q, blocks, startOf]);

  useEffect(() => { setAt(0); }, [q]);
  useEffect(() => { if (hits[at]) seek(hits[at].startMs); }, [at, hits]);

  const replaceOne = () => {
    const h = hits[at];
    if (!h) return;
    update((p) => {
      const b = p.blocks.find((x) => x.id === h.blockId);
      const w = b?.words?.[h.wordIndex];
      if (!b || !w) return p;
      w.text = w.text.replace(new RegExp(q, 'i'), rep);
      b.text = (b.words || []).filter((x) => !x.del).map((x) => x.text).join(' ');
      b.dirty = true;
      return p;
    });
  };

  const replaceAll = () => {
    update((p) => {
      p.blocks.forEach((b) => {
        let touched = false;
        (b.words || []).forEach((w) => {
          if (!w.del && w.text.toLowerCase().includes(q.toLowerCase())) {
            w.text = w.text.replace(new RegExp(q, 'ig'), rep);
            touched = true;
          }
        });
        if (touched) {
          b.text = (b.words || []).filter((x) => !x.del).map((x) => x.text).join(' ');
          b.dirty = true;
        }
      });
      return p;
    });
    setQ('');
  };

  const step = (d: number) => setAt((n) => (hits.length ? (n + d + hits.length) % hits.length : 0));

  return (
    <div className="tsearch">
      <div className="tsearch-row">
        <Icon n="search" s={13} />
        <input
          ref={input} className="inp" placeholder="Find in transcript" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') step(e.shiftKey ? -1 : 1); }}
        />
        <span className="tsearch-n">{hits.length ? `${at + 1}/${hits.length}` : q ? '0' : ''}</span>
        <button className="icon-btn" onClick={() => step(-1)} disabled={!hits.length} aria-label="Previous match"><Icon n="up" s={13} /></button>
        <button className="icon-btn" onClick={() => step(1)} disabled={!hits.length} aria-label="Next match"><Icon n="down" s={13} /></button>
        <button className="icon-btn" onClick={onClose} aria-label="Close search"><Icon n="x" s={13} /></button>
      </div>
      <div className="tsearch-row">
        <span className="tsearch-gap" />
        <input
          className="inp" placeholder="Replace with" value={rep}
          onChange={(e) => setRep(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') replaceOne(); }}
        />
        <button className="act" onClick={replaceOne} disabled={!hits.length}>Replace</button>
        <button className="act" onClick={replaceAll} disabled={!hits.length}>All</button>
      </div>
    </div>
  );
};

/** Word indices to highlight, so the transcript can mark every match. */
export function useSearchHighlight(q: string) {
  return useMemo(() => q.trim().toLowerCase(), [q]);
}
