import type { Project } from '../store/types';
import { projectDurationMs } from '../store/validate';

/**
 * Build the payload the Remotion ProductShowcase composition expects.
 * The trigger Lambda wraps this as { payload }, matching src/render.ts.
 * Media must be S3 keys by now: a blob URL cannot be read by the renderer.
 */
export function buildRenderPayload(p: Project, resolveUrl: (key: string) => string) {
  const videos = p.media
    .filter((m) => m.kind === 'video')
    .map((m) => ({ id: m.id, url: resolveUrl(m.url), filename: m.name }));
  const audios = p.media
    .filter((m) => m.kind === 'audio')
    .map((m) => ({ id: m.id, url: resolveUrl(m.url), filename: m.name }));

  return {
    jobId: 'fd_' + Date.now().toString(36),
    mode: 'flowdemo',
    module: { name: p.name },
    videos,
    audios,
    segments: p.segments.map((s) => ({
      id: s.id, kind: 'recording', videoId: s.videoId,
      startMs: s.startMs, durationMs: s.durationMs,
      sourceStartMs: s.sourceStartMs || 0,
      speed: s.speed || 1,
      muteSourceAudio: s.muteSourceAudio !== false,
    })),
    audioPlacements: [],
    callouts: p.callouts.map((c) => ({
      id: c.id, startMs: c.startMs, durationMs: c.durationMs,
      text: c.text, x: c.x, y: c.y, coType: c.coType,
    })),
    textOverlays: p.textOverlays.map((t) => ({
      id: t.id, startMs: t.startMs, durationMs: t.durationMs,
      text: t.text, x: t.x, y: t.y, fontSize: t.fontSize, color: t.color,
    })),
    shapes: p.shapes.map((s) => ({
      id: s.id, startMs: s.startMs, durationMs: s.durationMs,
      kind: s.kind, x: s.x, y: s.y, width: s.width, height: s.height,
      fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth,
      opacity: s.opacity, rotation: s.rotation,
      radius: s.radius, sides: s.sides, innerRatio: s.innerRatio,
    })),
    effects: p.effects.map((e) => ({
      id: e.id, type: e.type, startMs: e.startMs, durationMs: e.durationMs,
      x: e.x, y: e.y, scale: e.scale || 1,
    })),
    customerCards: [],
    background: p.background,
    durationMs: projectDurationMs(p),
    rendererVersion: 'flowdemo-next',
  };
}

/** A render can only reference stored media, never a local blob. */
export function unstoredAssets(p: Project) {
  return p.media.filter((m) => m.url.startsWith('blob:')).map((m) => m.name);
}
