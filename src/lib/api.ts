/** Every call is same-origin. The worker holds the keys and does the proxying. */

export interface UploadResult { key: string; publicUrl: string }

async function jsonOrThrow(r: Response, what: string) {
  const t = await r.text();
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(t);
  } catch {
    // A missing route returns the SPA's HTML, which is useless as an error.
    // Say what is actually wrong instead of pasting markup at the user.
    if (t.trimStart().startsWith('<')) {
      throw new Error(`${what} is not reachable — the endpoint returned a web page, not data (${r.status})`);
    }
    throw new Error(`${what}: ${t.slice(0, 160)}`);
  }
  if (!r.ok || d.error) throw new Error(String(d.error || `${what} failed (${r.status})`));
  return d;
}

/** Ping each backing service so a misconfiguration is visible, not guessed at. */
export async function checkServices() {
  const out: { name: string; ok: boolean; detail: string }[] = [];
  const probe = async (name: string, url: string, init?: RequestInit) => {
    try {
      const r = await fetch(url, init);
      const t = await r.text();
      const html = t.trimStart().startsWith('<');
      out.push({
        name,
        ok: r.ok && !html,
        detail: html ? `returned a web page (${r.status}), so the route is missing` : `${r.status}`,
      });
    } catch (e) {
      out.push({ name, ok: false, detail: String((e as Error).message) });
    }
  };
  await probe('Uploads', '/api/upload-url?key=probe.txt&contentType=text/plain');
  await probe('Transcription', '/api/transcribe', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ audioUrl: 'https://example.com/probe.mp3' }),
  });
  await probe('Voice', '/api/tts', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'probe', voiceId: '' }),
  });
  await probe('Lip-sync', '/api/lipsync', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ videoUrl: 'https://example.com/a.mp4', audioUrl: 'https://example.com/a.mp3' }),
  });
  return out;
}

/** Presign, PUT the bytes straight to S3, return the key. */
export async function uploadFile(file: File, onProgress?: (pct: number) => void): Promise<UploadResult> {
  const safe = file.name.replace(/[^\w.-]/g, '_');
  const key = `uploads/editor/${Date.now()}_${safe}`;
  const d = await jsonOrThrow(
    await fetch(`/api/upload-url?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(file.type || 'application/octet-stream')}`),
    'upload url'
  );

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', String(d.uploadUrl || d.url));
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('upload failed'));
    xhr.send(file);
  });

  return { key, publicUrl: String(d.publicUrl || '') };
}

/** The bucket is private, so playback needs a signed URL. */
export async function signedUrl(key: string): Promise<string> {
  const d = await jsonOrThrow(await fetch(`/api/media-url?key=${encodeURIComponent(key)}`), 'media url');
  return String(d.url);
}

export async function startRender(payload: unknown) {
  return jsonOrThrow(
    await fetch('/api/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }),
    'render'
  );
}

export async function renderStatus(id: string, bucket: string) {
  return jsonOrThrow(
    await fetch(`/api/render-status?id=${encodeURIComponent(id)}&bucket=${encodeURIComponent(bucket)}`),
    'render status'
  );
}

export async function transcribe(audioUrl: string) {
  return jsonOrThrow(
    await fetch('/api/transcribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ audioUrl }) }),
    'transcribe'
  );
}

/** Reads a video's real duration and dimensions before it goes on the timeline. */
export function probeVideo(file: File): Promise<{ durationMs: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    const url = URL.createObjectURL(file);
    v.onloadedmetadata = () => {
      // A file produced by MediaRecorder carries no duration in its metadata,
      // so video.duration reads Infinity. Seeking to the far end forces the
      // browser to work the real length out.
      if (!Number.isFinite(v.duration)) {
        v.currentTime = 1e6;
        v.ontimeupdate = () => {
          v.ontimeupdate = null;
          const d = Number.isFinite(v.duration) ? v.duration : 0;
          URL.revokeObjectURL(url);
          if (d > 0) resolve({ durationMs: Math.round(d * 1000), width: v.videoWidth || 1920, height: v.videoHeight || 1080 });
          else reject(new Error('could not read the length of that video'));
        };
        return;
      }
      URL.revokeObjectURL(url);
      resolve({
        durationMs: Math.max(100, Math.round(v.duration * 1000)),
        width: v.videoWidth || 1920,
        height: v.videoHeight || 1080,
      });
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not read that video')); };
    v.src = url;
  });
}
