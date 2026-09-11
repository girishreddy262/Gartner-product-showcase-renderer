import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/project';
import { createAvatar, isComplete, missingRequired, thumbnailFor, importClip, prepareAvatar, deleteAvatar } from '../../store/avatars';
import type { Avatar } from '../../store/types';
import { Icon } from '../Icon';
import { loadStock, useStock, type StockAvatar } from '../../store/stockAvatars';
import {
  generateAllAvatarClips, avatarCostFor, avatarMinutesUsed, onAvatarJobs, getAvatarJobs,
} from '../../store/avatarClips';

const Face: React.FC<{ avatar: Avatar }> = ({ avatar }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { let live = true; thumbnailFor(avatar).then((u) => live && setSrc(u)); return () => { live = false; }; },
    [avatar.id, avatar.clips.length]);
  return (
    <span className="av-face">
      {src ? <img src={src} alt="" /> : <Icon n="user" s={15} />}
    </span>
  );
};


/**
 * One control that delivers the whole script. The gesture comes from what each
 * paragraph says, and the cost is shown before anything is spent, because fal
 * bills per second of output.
 */
const DeliverAll: React.FC<{ avatarId: string; onDone: () => void }> = ({ avatarId, onDone }) => {
  const blocks = useStore((s) => s.project.blocks);
  const [capMin, setCapMin] = useState(10);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [jobs, setJobs] = useState(getAvatarJobs());
  useEffect(() => onAvatarJobs(setJobs), []);

  const [left, setLeft] = useState<number | null>(null);

  // Show what the allowance has left, so nobody discovers it by being refused.
  useEffect(() => {
    void fetch('/api/usage')
      .then((r) => r.json())
      .then((d: { usage?: Record<string, { used: number; allowed: number }> }) => {
        const u = d.usage?.lipsync_seconds;
        if (u) setLeft(Math.max(0, u.allowed - u.used));
      })
      .catch(() => setLeft(null));
  }, []);

  const ready = blocks.filter((b) => b.audioUrl || b.audioKey);
  const totalMs = ready.reduce((n, b) => n + b.durationMs, 0);
  const usedMs = avatarMinutesUsed();
  const capMs = capMin * 60_000;
  const willDo = Math.max(0, Math.min(totalMs, capMs - usedMs));
  const running = jobs.filter((j) => !j.error).length;

  const run = async () => {
    setBusy(true); setNote('');
    const r = await generateAllAvatarClips(avatarId, { capMs, onSkip: setNote });
    setBusy(false);
    if (r.skipped) setNote(`${r.made} done, ${r.skipped} left out to stay inside ${capMin} minutes.`);
    else if (r.made) { setNote(`${r.made} paragraphs delivered.`); onDone(); }
  };

  if (!ready.length) {
    return <p className="hint av-menu-hint">Generate the speech first, then the avatar can speak it.</p>;
  }

  return (
    <div className="av-deliver">
      <p className="hint av-menu-hint">
        {ready.length} paragraph{ready.length === 1 ? '' : 's'} ready,
        about {Math.round(totalMs / 1000)}s of video.
      </p>

      <label className="av-cap">
        <span>Stop after</span>
        <input
          type="number" min={1} max={120} value={capMin}
          onChange={(e) => setCapMin(Math.max(1, Number(e.target.value) || 1))}
          aria-label="Minutes of avatar video to allow"
        />
        <span>min</span>
      </label>

      <p className="hint av-cost">
        This run: about ${avatarCostFor(willDo).toFixed(2)}
        {usedMs > 0 && ` · ${Math.round(usedMs / 1000)}s already made`}
      </p>

      {left != null && (
        <p className={left < totalMs / 1000 ? 'hint av-low' : 'hint'}>
          {left < totalMs / 1000
            ? `Only ${Math.round(left / 60)} min of avatar allowance left, not enough for the whole script.`
            : `${Math.round(left / 60)} min of allowance left.`}
        </p>
      )}

      <button className="btn btn-primary" disabled={busy || !willDo} onClick={run}>
        {busy ? `Delivering${running ? ` (${running})` : ''}\u2026` : 'Deliver the whole script'}
      </button>

      {note && <p className="hint av-note">{note}</p>}
    </div>
  );
};

export const AvatarPanel: React.FC<{ onOpenStudio: (id: string) => void }> = ({ onOpenStudio }) => {
  const avatars = useStore((s) => s.project.avatars);
  const [name, setName] = useState('');
  const [naming, setNaming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [stock, setStock] = useState<StockAvatar[]>([]);

  // Only offered when this deployment actually has a licensed library.
  useEffect(() => { void loadStock().then(setStock); }, []);
  const pick = useRef<HTMLInputElement>(null);

  const create = () => {
    const n = name.trim() || 'My avatar';
    const id = createAvatar(n);
    setName('');
    setNaming(false);
    onOpenStudio(id);
  };

  /**
   * Build the avatar from footage that already exists. Most people have a
   * clip of themselves talking; asking them to re-record one on the spot is
   * a step they do not need.
   */
  const importExisting = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy('Reading that clip');
    let made: string | null = null;
    try {
      const id = createAvatar(name.trim() || file.name.replace(/\.[^.]+$/, ''));
      made = id;
      // One clip covers both: consent is the same footage of the same person,
      // and talking is what lip-sync actually drives.
      await importClip(id, 'consent', file);
      await importClip(id, 'talking', file);
      await importClip(id, 'idle', file);

      // Preparing is what marks the avatar ready; without it the paragraphs
      // never offer it and the import looks like it did nothing.
      setBusy('Preparing the avatar');
      await prepareAvatar(id);

      setName('');
      setNaming(false);
      setBusy(null);
      onOpenStudio(id);
    } catch (e) {
      // Do not leave an empty avatar behind when the file was unusable.
      if (made) deleteAvatar(made);
      setBusy(String((e as Error).message));
    }
  };

  return (
    <div className="panel-body">
      <input
        ref={pick} type="file" accept="video/*" hidden
        onChange={(e) => { void importExisting(e.target.files); e.target.value = ''; }}
      />
      {busy && <p className="hint av-busy">{busy}</p>}
      {naming ? (
        <div className="av-new">
          <input
            autoFocus value={name} placeholder="Name this avatar"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setNaming(false); }}
            aria-label="Avatar name"
          />
          <div className="av-new-row">
            <button className="act" onClick={() => setNaming(false)}>Cancel</button>
            <span className="spacer" />
            <button className="act" onClick={() => pick.current?.click()}>Use a clip I have</button>
            <button className="act" onClick={create}>Record now</button>
          </div>
        </div>
      ) : (
        <>
          <button className="import-btn" onClick={() => setNaming(true)} aria-label="Create an avatar">
            Create an avatar
          </button>
          <p className="hint av-hint">
            Record a few short takes, or build it from a clip of yourself you already have.
          </p>

          {stock.length > 0 && (
            <div className="av-stock">
              <p className="grp-label">Ready-made</p>
              <ul>
                {stock.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => useStock(s)}>
                      <span className="av-stock-face">{s.name.slice(0, 1)}</span>
                      <span className="av-meta">
                        <span className="av-name">{s.name}</span>
                        {s.note && <span className="av-sub">{s.note}</span>}
                      </span>
                      <span className="act">Use</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {!avatars.length && (
        <p className="hint">
          Record yourself once, then any script can be delivered in your own face and voice. It takes
          about two minutes and you keep the takes.
        </p>
      )}

      <ul className="av-list">
        {avatars.map((a) => {
          const ready = a.status === 'ready';
          const complete = isComplete(a);
          const left = missingRequired(a).length;
          return (
            <li key={a.id}>
              <button
                onClick={() => (left ? onOpenStudio(a.id) : setMenuFor(menuFor === a.id ? null : a.id))}
                aria-label={left ? `Finish setting up ${a.name}` : `Options for ${a.name}`}
              >
                <Face avatar={a} />
                <span className="av-meta">
                  <span className="av-name">{a.name}</span>
                  <span className="av-sub">
                    {a.status === 'preparing' ? 'Preparing'
                      : ready ? `${a.clips.length} clips`
                      : complete ? 'Ready to prepare'
                      : `${left} required clip${left === 1 ? '' : 's'} left`}
                  </span>
                </span>
                {ready && <span className="av-dot" />}
              </button>

              {menuFor === a.id && (
                <div className="av-menu" role="menu">
                  <DeliverAll avatarId={a.id} onDone={() => setMenuFor(null)} />
                  <button onClick={() => { setMenuFor(null); onOpenStudio(a.id); }}>
                    <Icon n="play" s={13} />Review or retake clips
                  </button>
                  <button onClick={() => { setMenuFor(null); void prepareAvatar(a.id); }}>
                    <Icon n="undo" s={13} />Prepare again
                  </button>
                  <button
                    className="av-menu-danger"
                    onClick={() => { setMenuFor(null); deleteAvatar(a.id); }}
                  >
                    <Icon n="eraser" s={13} />Delete this avatar
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
