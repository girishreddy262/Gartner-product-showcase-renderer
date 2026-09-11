export type RecordSource = 'screen' | 'camera' | 'both';

export interface Devices { mics: MediaDeviceInfo[]; cams: MediaDeviceInfo[] }

export async function listDevices(): Promise<Devices> {
  try {
    // Labels stay blank until permission has been granted at least once.
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    const all = await navigator.mediaDevices.enumerateDevices();
    probe?.getTracks().forEach((t) => t.stop());
    return {
      mics: all.filter((d) => d.kind === 'audioinput'),
      cams: all.filter((d) => d.kind === 'videoinput'),
    };
  } catch {
    return { mics: [], cams: [] };
  }
}

/** Peak level 0..1, for the meter in the setup dialog. */
export function meterStream(stream: MediaStream, onLevel: (v: number) => void) {
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 512;
  src.connect(an);
  const buf = new Uint8Array(an.frequencyBinCount);
  let raf = 0;
  const tick = () => {
    an.getByteTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128) / 128);
    onLevel(peak);
    raf = requestAnimationFrame(tick);
  };
  tick();
  return () => { cancelAnimationFrame(raf); ctx.close().catch(() => {}); };
}

function pickMime(): string {
  const want = ['video/mp4;codecs=h264,aac', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const m of want) if (MediaRecorder.isTypeSupported(m)) return m;
  return '';
}

interface Track { recorder: MediaRecorder; chunks: Blob[]; stream: MediaStream; kind: 'screen' | 'camera' }

export interface RecordingResult { screen?: File; camera?: File; mime: string; durationMs: number }

/**
 * Screen and camera are recorded as SEPARATE files rather than composited, so
 * the webcam bubble stays editable afterwards: position, size and shape are
 * decisions the user can change, not baked pixels.
 */
export class Recorder {
  private tracks: Track[] = [];
  private mime = '';
  private startedAt = 0;
  private pausedFor = 0;
  private pausedAt = 0;

  async start(opts: { source: RecordSource; micId?: string; camId?: string }) {
    this.mime = pickMime();
    const audio: MediaTrackConstraints = opts.micId
      ? { deviceId: { exact: opts.micId }, echoCancellation: true, noiseSuppression: true }
      : { echoCancellation: true, noiseSuppression: true };

    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio });
    } catch { /* recording without a mic is still valid */ }

    if (opts.source === 'screen' || opts.source === 'both') {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      // Mic travels with the screen take, since that is the main picture.
      const mixed = new MediaStream([
        ...display.getVideoTracks(),
        ...(micStream ? micStream.getAudioTracks() : display.getAudioTracks()),
      ]);
      this.addTrack(mixed, 'screen');
      // Stopping the share from the browser's own bar must stop us too.
      display.getVideoTracks()[0]?.addEventListener('ended', () => this.onShareEnded?.());
    }

    if (opts.source === 'camera' || opts.source === 'both') {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: opts.camId ? { deviceId: { exact: opts.camId }, width: 1280, height: 720 } : { width: 1280, height: 720 },
        // Only carry audio on the camera track when it is the only track.
        audio: opts.source === 'camera' ? audio : false,
      });
      const stream = opts.source === 'camera' && micStream
        ? new MediaStream([...camStream.getVideoTracks(), ...micStream.getAudioTracks()])
        : camStream;
      this.addTrack(stream, 'camera');
    }

    this.startedAt = performance.now();
    this.tracks.forEach((t) => t.recorder.start(1000));
    return this.tracks.find((t) => t.kind === 'camera')?.stream || null;
  }

  onShareEnded?: () => void;

  private addTrack(stream: MediaStream, kind: 'screen' | 'camera') {
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, this.mime ? { mimeType: this.mime } : undefined);
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    this.tracks.push({ recorder, chunks, stream, kind });
  }

  pause() {
    if (this.pausedAt) return;
    this.pausedAt = performance.now();
    this.tracks.forEach((t) => t.recorder.state === 'recording' && t.recorder.pause());
  }

  resume() {
    if (!this.pausedAt) return;
    this.pausedFor += performance.now() - this.pausedAt;
    this.pausedAt = 0;
    this.tracks.forEach((t) => t.recorder.state === 'paused' && t.recorder.resume());
  }

  get paused() { return this.pausedAt > 0; }

  elapsedMs() {
    if (!this.startedAt) return 0;
    const now = this.pausedAt || performance.now();
    return Math.max(0, now - this.startedAt - this.pausedFor);
  }

  async stop(): Promise<RecordingResult> {
    const ext = this.mime.includes('mp4') ? 'mp4' : 'webm';
    const done = this.tracks.map((t) => new Promise<void>((res) => {
      t.recorder.onstop = () => res();
      if (t.recorder.state !== 'inactive') t.recorder.stop(); else res();
    }));
    await Promise.all(done);
    this.tracks.forEach((t) => t.stream.getTracks().forEach((tr) => tr.stop()));

    const out: RecordingResult = { mime: this.mime, durationMs: Math.round(this.elapsedMs()) };
    for (const t of this.tracks) {
      const blob = new Blob(t.chunks, { type: this.mime || 'video/webm' });
      const file = new File([blob], `${t.kind}-${Date.now()}.${ext}`, { type: blob.type });
      if (t.kind === 'screen') out.screen = file; else out.camera = file;
    }
    this.tracks = [];
    return out;
  }

  discard() {
    this.tracks.forEach((t) => {
      if (t.recorder.state !== 'inactive') t.recorder.stop();
      t.stream.getTracks().forEach((tr) => tr.stop());
    });
    this.tracks = [];
  }
}
