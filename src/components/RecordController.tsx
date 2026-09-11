import React, { useEffect, useRef, useState } from 'react';
import type { Recorder } from '../lib/recorder';
import { importRecording } from '../store/media';
import { Icon } from './Icon';
import { fmt } from '../lib/time';

/**
 * Floats over the editor while capturing. Draggable, because it will otherwise
 * sit on top of whatever the user is trying to demonstrate.
 */
export const RecordController: React.FC<{
  rec: Recorder;
  camStream: MediaStream | null;
  onDone: () => void;
}> = ({ rec, camStream, onDone }) => {
  const [ms, setMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const vid = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t = setInterval(() => setMs(rec.elapsedMs()), 200);
    rec.onShareEnded = () => { void finish(); };
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (vid.current && camStream) vid.current.srcObject = camStream;
  }, [camStream]);

  const finish = async () => {
    const out = await rec.stop();
    onDone();
    await importRecording({ screen: out.screen, camera: out.camera, durationMs: out.durationMs });
  };

  const drag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const sx = e.clientX, sy = e.clientY, ox = pos.x, oy = pos.y;
    const move = (ev: PointerEvent) => setPos({ x: ox + ev.clientX - sx, y: oy + ev.clientY - sy });
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="rec-ctl" style={{ transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px)` }} onPointerDown={drag} role="toolbar" aria-label="Recording">
      {camStream && <video ref={vid} className="rec-cam" autoPlay muted playsInline />}
      <span className="rec-dot" data-paused={paused} />
      <span className="mono rec-time">{fmt(ms)}</span>
      <span className="sep" />
      <button
        className="icon-btn"
        aria-label={paused ? 'Resume recording' : 'Pause recording'}
        onClick={() => { paused ? rec.resume() : rec.pause(); setPaused(!paused); }}
      >
        <Icon n={paused ? 'play' : 'pause'} s={15} />
      </button>
      <button className="icon-btn rec-stop" aria-label="Stop recording" onClick={finish}><Icon n="stop" s={15} /></button>
      <button className="icon-btn" aria-label="Discard recording" onClick={() => { rec.discard(); onDone(); }}>
        <Icon n="trash" s={14} />
      </button>
    </div>
  );
};
