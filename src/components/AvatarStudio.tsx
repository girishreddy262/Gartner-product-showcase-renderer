import React, { useEffect, useRef, useState } from 'react';
import { GESTURES } from '../store/types';
import { addClip, getAvatar, isComplete, missingRequired, prepareAvatar, onAvatars } from '../store/avatars';
import { useStore } from '../store/project';
import { Recorder } from '../lib/recorder';
import { Icon } from './Icon';

type Phase = 'prompt' | 'counting' | 'recording' | 'review';

export const AvatarStudio: React.FC<{ avatarId: string; onClose: () => void }> = ({ avatarId, onClose }) => {
  const avatars = useStore((s) => s.project.avatars);
  const avatar = avatars.find((a) => a.id === avatarId);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('prompt');
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [err, setErr] = useState('');
  const [take, setTake] = useState<{ file: File; url: string; durationMs: number } | null>(null);

  const preview = useRef<HTMLVideoElement>(null);
  const review = useRef<HTMLVideoElement>(null);
  const rec = useRef<Recorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [, force] = useState(0);
  useEffect(() => onAvatars(() => force((n) => n + 1)), []);

  const g = GESTURES[step];
  const captured = new Set(avatar?.clips.map((c) => c.gesture) || []);

  // One camera stream for the whole wizard, so the preview never flickers
  // between takes and the user can see themselves while reading the prompt.
  useEffect(() => {
    let dead = false;
    navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
      .then((s) => {
        if (dead) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (preview.current) preview.current.srcObject = s;
      })
      .catch(() => setErr('Camera permission was declined.'));
    return () => {
      dead = true;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (preview.current && stream.current) preview.current.srcObject = stream.current;
  }, [phase, step]);

  useEffect(() => {
    if (take && review.current) review.current.src = take.url;
  }, [take]);

  const start = async () => {
    setErr('');
    setPhase('counting');
    for (let n = 3; n > 0; n--) { setCount(n); await new Promise((r) => setTimeout(r, 1000)); }
    try {
      const r = new Recorder();
      await r.start({ source: 'camera' });
      rec.current = r;
      setPhase('recording');
      setElapsed(0);
      const t0 = Date.now();
      const tick = setInterval(() => {
        const e = Date.now() - t0;
        setElapsed(e);
        if (e >= g.seconds * 1000) { clearInterval(tick); void stop(); }
      }, 100);
    } catch (e) {
      setErr(String((e as Error).message));
      setPhase('prompt');
    }
  };

  const stop = async () => {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    const out = await r.stop();
    const file = out.camera || out.screen;
    if (!file) { setErr('Nothing was captured.'); setPhase('prompt'); return; }
    setTake({ file, url: URL.createObjectURL(file), durationMs: out.durationMs });
    setPhase('review');
  };

  const keep = async () => {
    if (!take) return;
    await addClip(avatarId, g.key, take.file, take.durationMs);
    setTake(null);
    setPhase('prompt');
    if (step < GESTURES.length - 1) setStep(step + 1);
  };

  const finish = async () => { await prepareAvatar(avatarId); onClose(); };

  if (!avatar) return null;
  const missing = missingRequired(avatar);
  const done = isComplete(avatar);

  return (
    <div className="modal-scrim">
      <div className="modal modal-lg studio" role="dialog" aria-label="Create your avatar">
        <div className="studio-head">
          <span>{avatar.name}</span>
          <span className="hint">Step {step + 1} of {GESTURES.length}</span>
          <span className="spacer" />
          <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon n="close" s={15} /></button>
        </div>

        <div className="studio-body">
          <ol className="studio-list">
            {GESTURES.map((x, i) => (
              <li key={x.key} data-on={i === step} data-done={captured.has(x.key)}>
                <button onClick={() => { setStep(i); setPhase('prompt'); setTake(null); }} aria-label={x.label}>
                  {captured.has(x.key)
                    ? <Icon n="check" s={14} />
                    : <span className="dot" data-cur={i === step} />}
                  <span className="studio-name">{x.label}</span>
                  {!x.required && <span className="studio-opt">optional</span>}
                </button>
              </li>
            ))}
          </ol>

          <div className="studio-stage">
            <div className="studio-video">
              {phase === 'review' && take
                ? <video ref={review} className="studio-feed studio-review" controls playsInline autoPlay loop />
                : <video ref={preview} className="studio-feed" autoPlay muted playsInline />}

              {phase === 'counting' && <div className="studio-count">{count}</div>}

              {phase === 'recording' && (
                <div className="studio-rec">
                  <span className="rec-dot" />
                  <span className="mono">{(elapsed / 1000).toFixed(1)}s</span>
                  <span className="hint">of {g.seconds}s</span>
                </div>
              )}

              {(phase === 'prompt' || phase === 'recording') && (
                <div className="studio-prompt">{g.prompt}</div>
              )}

              {phase === 'recording' && (
                <div className="studio-bar"><i style={{ width: `${Math.min(100, (elapsed / (g.seconds * 1000)) * 100)}%` }} /></div>
              )}
            </div>

            {g.key !== 'consent' && (
              <p className="hint studio-tip">
                Start and finish with your hands down and your eyes on the lens. The clip loops, so
                returning to where you began keeps the join invisible.
              </p>
            )}
            {err && <p className="hint" style={{ color: 'var(--danger)' }}>{err}</p>}
          </div>
        </div>

        <div className="studio-foot">
          {done
            ? <span className="hint">Ready to prepare</span>
            : <span className="hint">{missing.length} required clip{missing.length === 1 ? '' : 's'} left</span>}
          <span className="spacer" />
          {phase === 'review' ? (
            <>
              <button className="act" onClick={() => { setTake(null); setPhase('prompt'); }}>Retake</button>
              <button className="btn btn-primary" onClick={keep}>Use this take</button>
            </>
          ) : (
            <>
              {!g.required && <button className="act" onClick={() => step < GESTURES.length - 1 && setStep(step + 1)}>Skip</button>}
              {phase === 'recording'
                ? <button className="btn btn-primary" onClick={stop}>Stop</button>
                : <button className="btn btn-primary" disabled={phase === 'counting'} onClick={start}>
                    {captured.has(g.key) ? 'Record again' : 'Record'}
                  </button>}
              {done && <button className="btn btn-primary" onClick={finish}>Finish</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
