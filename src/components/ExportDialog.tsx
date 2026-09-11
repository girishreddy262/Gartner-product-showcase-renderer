import React, { useEffect, useState } from 'react';
import { useStore } from '../store/project';
import { buildRenderPayload, unstoredAssets } from '../lib/renderPayload';
import { startRender, renderStatus, signedUrl } from '../lib/api';
import { projectDurationMs } from '../store/validate';
import { fmt } from '../lib/time';

type Phase = 'options' | 'rendering' | 'done' | 'error';
import { ASPECTS, RESOLUTIONS } from '../store/types';

export const ExportDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const p = useStore((s) => s.project);
  const [res, setRes] = useState(p.resolution || '1080p');
  const [phase, setPhase] = useState<Phase>('options');
  const [pct, setPct] = useState(0);
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const [job, setJob] = useState<{ id: string; bucket: string } | null>(null);

  const total = projectDurationMs(p);
  const pending = unstoredAssets(p);
  const canRender = p.segments.length > 0 && pending.length === 0;

  useEffect(() => {
    if (phase !== 'rendering' || !job) return;
    let stop = false;
    const tick = async () => {
      try {
        const s = await renderStatus(job.id, job.bucket) as Record<string, unknown>;
        if (stop) return;
        setPct(Math.round(Number(s.progress || 0) * 100));
        if (s.done) { setUrl(String(s.url || '')); setPhase('done'); return; }
        const errs = (s.errors as string[]) || [];
        if (errs.length) { setErr(errs[0]); setPhase('error'); return; }
        setTimeout(tick, 3000);
      } catch (e) {
        if (!stop) { setErr(String((e as Error).message)); setPhase('error'); }
      }
    };
    tick();
    return () => { stop = true; };
  }, [phase, job]);

  const go = async () => {
    setPhase('rendering');
    setPct(0);
    try {
      const keys = new Map<string, string>();
      for (const m of p.media) if (!m.url.startsWith('blob:')) keys.set(m.url, await signedUrl(m.url));
      const payload = buildRenderPayload(p, (k) => keys.get(k) || k);
      const r = await startRender({ ...payload, resolution: res }) as Record<string, string>;
      if (!r.renderId) throw new Error('the render did not start');
      setJob({ id: r.renderId, bucket: r.bucketName });
    } catch (e) {
      setErr(String((e as Error).message));
      setPhase('error');
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Export">
        {phase === 'options' && (
          <>
            <div className="modal-title">Export</div>
            <div className="grp-label">Resolution</div>
            <div className="seg">
              {RESOLUTIONS.map((r) => (
                <button key={r.key} data-on={res === r.key} onClick={() => setRes(r.key)}>{r.label}</button>
              ))}
            </div>
            <div className="row-toggle" style={{ marginTop: 16 }}>
              <span>Aspect</span><span className="spacer" />
              <span className="mono val">{ASPECTS.find((a) => a.key === p.aspect)?.label || '16:9'}</span>
            </div>
            {!p.segments.length && <p className="hint">Add footage to the timeline first.</p>}
            {pending.length > 0 && <p className="hint">Still uploading: {pending.join(', ')}</p>}
            <div className="modal-foot">
              <span className="hint">{fmt(total)} of video</span>
              <span className="spacer" />
              <button className="act" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={!canRender} onClick={go}>Export</button>
            </div>
          </>
        )}

        {phase === 'rendering' && (
          <>
            <div className="modal-title">Rendering {res}</div>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            <p className="hint">{pct}% · you can keep editing, and closing the tab will not stop it.</p>
            <div className="modal-foot"><span className="spacer" /><button className="act" onClick={onClose}>Hide</button></div>
          </>
        )}

        {phase === 'done' && (
          <>
            <div className="modal-title">Ready</div>
            <p className="hint">{p.name} · {res} · {fmt(total)}</p>
            <div className="modal-foot">
              <span className="spacer" />
              <button className="act" onClick={onClose}>Close</button>
              <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">Download</a>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="modal-title">Export stopped</div>
            <p className="hint">{err}</p>
            <div className="modal-foot">
              <span className="spacer" />
              <button className="act" onClick={onClose}>Close</button>
              <button className="btn btn-primary" onClick={() => setPhase('options')}>Try again</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
