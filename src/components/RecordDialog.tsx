import React, { useEffect, useRef, useState } from 'react';
import { listDevices, meterStream, Recorder, type RecordSource } from '../lib/recorder';
import { Icon } from './Icon';

const SOURCES: { key: RecordSource; label: string; icon: string }[] = [
  { key: 'screen', label: 'Screen', icon: 'screen' },
  { key: 'camera', label: 'Camera', icon: 'cam' },
  { key: 'both', label: 'Both', icon: 'both' },
];

export const RecordDialog: React.FC<{
  initialSource?: RecordSource;
  onClose: () => void;
  onStart: (r: Recorder, camStream: MediaStream | null) => void;
}> = ({ initialSource = 'screen', onClose, onStart }) => {
  const [source, setSource] = useState<RecordSource>(initialSource);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState('');
  const [camId, setCamId] = useState('');
  const [level, setLevel] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [counting, setCounting] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const stopMeter = useRef<(() => void) | null>(null);

  useEffect(() => {
    listDevices().then(({ mics, cams }) => {
      setMics(mics); setCams(cams);
      setMicId(mics[0]?.deviceId || '');
      setCamId(cams[0]?.deviceId || '');
    });
    return () => stopMeter.current?.();
  }, []);

  // Live level so a muted or wrong mic is obvious before recording, not after.
  useEffect(() => {
    let dead = false;
    stopMeter.current?.();
    if (!micId) return;
    navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: micId } } })
      .then((s) => {
        if (dead) { s.getTracks().forEach((t) => t.stop()); return; }
        const stop = meterStream(s, setLevel);
        stopMeter.current = () => { stop(); s.getTracks().forEach((t) => t.stop()); };
      })
      .catch(() => {});
    return () => { dead = true; };
  }, [micId]);

  const begin = async () => {
    setErr('');
    try {
      const rec = new Recorder();
      // The picker must open from the click, so ask before counting down.
      const camStream = await rec.start({ source, micId, camId });
      stopMeter.current?.();
      if (countdown > 0) {
        for (let n = countdown; n > 0; n--) {
          setCounting(n);
          await new Promise((r) => setTimeout(r, 1000));
        }
        setCounting(null);
      }
      onStart(rec, camStream);
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      setErr(/denied|Permission/i.test(msg) ? 'Permission was declined.' : msg);
      setCounting(null);
    }
  };

  if (counting !== null) {
    return (
      <div className="modal-scrim">
        <div className="countdown"><span>{counting}</span></div>
      </div>
    );
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Record">
        <div className="modal-title">Record</div>

        <div className="src-row">
          {SOURCES.map((s) => (
            <button key={s.key} className="src" data-on={source === s.key} onClick={() => setSource(s.key)} aria-label={s.label}>
              <Icon n={s.icon} s={19} />
              <em>{s.label}</em>
            </button>
          ))}
        </div>

        <div className="field">
          <span>Microphone</span><span className="spacer" />
          <select value={micId} onChange={(e) => setMicId(e.target.value)} aria-label="Microphone">
            {!mics.length && <option value="">No microphone</option>}
            {mics.map((m) => <option key={m.deviceId} value={m.deviceId}>{m.label || 'Microphone'}</option>)}
          </select>
          <span className="meter" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => <i key={i} data-on={level * 5 > i} />)}
          </span>
        </div>

        {(source === 'camera' || source === 'both') && (
          <div className="field">
            <span>Camera</span><span className="spacer" />
            <select value={camId} onChange={(e) => setCamId(e.target.value)} aria-label="Camera">
              {!cams.length && <option value="">No camera</option>}
              {cams.map((c) => <option key={c.deviceId} value={c.deviceId}>{c.label || 'Camera'}</option>)}
            </select>
          </div>
        )}

        <div className="field">
          <span>Countdown</span><span className="spacer" />
          <div className="seg seg-sm" role="group" aria-label="Countdown">
            {[0, 3, 5].map((n) => (
              <button key={n} data-on={countdown === n} onClick={() => setCountdown(n)}>{n === 0 ? 'Off' : `${n}s`}</button>
            ))}
          </div>
        </div>

        {err && <p className="hint" style={{ color: 'var(--danger)' }}>{err}</p>}
        {source !== 'camera' && <p className="hint">You will be asked which screen or window to share.</p>}

        <div className="modal-foot">
          <span className="spacer" />
          <button className="act" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={begin}>Start recording</button>
        </div>
      </div>
    </div>
  );
};
