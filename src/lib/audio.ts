/**
 * Transcription needs audio, not video. Sending a 31-minute mp4 pushes several
 * hundred megabytes through a Worker that can only hold 128MB, so the audio is
 * extracted here, in the browser, and only that is uploaded.
 *
 * 16kHz mono is what speech models want anyway; it is roughly 2MB a minute,
 * about a hundredth of the video.
 */
const TARGET_RATE = 16000;

/** Longest single piece we will send. Ten minutes is ~19MB at 16kHz mono. */
export const CHUNK_MS = 10 * 60 * 1000;

export interface ExtractedAudio { blob: Blob; durationMs: number }

async function decodeToMono16k(file: Blob, onProgress?: (p: number) => void): Promise<AudioBuffer> {
  const bytes = await file.arrayBuffer();
  onProgress?.(0.35);
  // Decoding straight into a 16kHz context resamples during decode rather than
  // after, which keeps peak memory far lower on long files.
  const Ctx = (window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext);
  const probe = new Ctx(1, 1, TARGET_RATE);
  const buf = await probe.decodeAudioData(bytes);
  onProgress?.(0.7);
  return buf;
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(bytes);
  const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

/** Average the channels down to one, since speech models ignore stereo. */
function toMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < buf.length; i++) out[i] += ch[i] / buf.numberOfChannels;
  }
  return out;
}

export async function extractAudio(file: Blob, onProgress?: (p: number) => void): Promise<ExtractedAudio> {
  const buf = await decodeToMono16k(file, onProgress);
  const mono = toMono(buf);
  onProgress?.(0.9);
  const blob = encodeWav(mono, buf.sampleRate);
  onProgress?.(1);
  return { blob, durationMs: Math.round((buf.length / buf.sampleRate) * 1000) };
}

/** Split long audio so no single upload approaches the Worker's memory limit. */
export async function extractAudioChunks(
  file: Blob, onProgress?: (p: number) => void
): Promise<{ blob: Blob; offsetMs: number }[]> {
  const buf = await decodeToMono16k(file, onProgress);
  const mono = toMono(buf);
  const rate = buf.sampleRate;
  const per = Math.floor((CHUNK_MS / 1000) * rate);
  const out: { blob: Blob; offsetMs: number }[] = [];
  for (let start = 0; start < mono.length; start += per) {
    const slice = mono.subarray(start, Math.min(mono.length, start + per));
    out.push({ blob: encodeWav(new Float32Array(slice), rate), offsetMs: Math.round((start / rate) * 1000) });
    onProgress?.(0.9 + 0.1 * (start / mono.length));
  }
  onProgress?.(1);
  return out;
}
