import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/project';
import { playableUrl } from '../store/media';
import type { Segment } from '../store/types';
import { CANVAS_W, CANVAS_H } from '../store/types';

/**
 * The real video surface. One <video> element, repointed as the playhead moves
 * between segments, and kept in sync rather than played independently: the
 * timeline is the clock, the element follows it.
 */
/** The face track, drawn over the main picture and independently placeable. */
const CameraBubble: React.FC = () => {
  const p = useStore((st) => st.project);
  const ms = useStore((st) => st.playheadMs);
  const playing = useStore((st) => st.playing);
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState('');

  const cam = p.camera.find((c) => ms >= c.startMs && ms < c.startMs + c.durationMs);
  const asset = cam ? p.media.find((m) => m.id === cam.videoId) : undefined;

  useEffect(() => {
    let alive = true;
    if (!asset) { setSrc(''); return; }
    playableUrl(asset).then((u) => { if (alive) setSrc(u); }).catch(() => {});
    return () => { alive = false; };
  }, [asset?.id, asset?.url]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !cam || !src) return;
    const want = ((ms - cam.startMs) + (cam.sourceStartMs || 0)) / 1000;
    if (Math.abs(v.currentTime - want) > 0.25) { try { v.currentTime = want; } catch { /* pre-metadata */ } }
  }, [ms, cam?.id, src]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing && cam) v.play().catch(() => {}); else v.pause();
  }, [playing, cam?.id, src]);

  if (!cam || !src) return null;
  const size = cam.size || 320;
  const radius = cam.shape === 'circle' ? '50%' : cam.shape === 'rounded' ? '14%' : '2%';
  return (
    <video
      ref={ref}
      className="cam-bubble"
      src={src}
      muted
      playsInline
      style={{
        left: `${((cam.x ?? 1480) / CANVAS_W) * 100}%`,
        top: `${((cam.y ?? 700) / CANVAS_H) * 100}%`,
        width: `${(size / CANVAS_W) * 100}%`,
        aspectRatio: '1 / 1',
        borderRadius: radius,
      }}
    />
  );
};

export const Stage: React.FC = () => {
  const p = useStore((s) => s.project);
  const ms = useStore((s) => s.playheadMs);
  const playing = useStore((s) => s.playing);
  const vidRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string>('');
  const currentAsset = useRef<string>('');

  // A segment can outlast its footage: holdTailMs freezes the last frame while
  // the voice finishes, so the clip still owns the playhead during the hold.
  const seg = p.segments.find(
    (s) => ms >= s.startMs && ms < s.startMs + s.durationMs + (s.holdTailMs || 0)
  ) as Segment | undefined;
  const asset = seg ? p.media.find((m) => m.id === seg.videoId) : undefined;

  // Resolve the playable URL only when the underlying asset changes.
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let alive = true;
    if (!asset) { setSrc(''); setProblem(''); currentAsset.current = ''; return; }
    if (currentAsset.current === asset.id && src) return;
    currentAsset.current = asset.id;
    setProblem('');
    playableUrl(asset)
      .then((u) => { if (alive) setSrc(u); })
      .catch((e) => { if (alive) { setSrc(''); setProblem(String((e as Error).message)); } });
    return () => { alive = false; };
  }, [asset?.id, asset?.url]);

  // Keep the element on the frame the playhead is pointing at.
  useEffect(() => {
    const v = vidRef.current;
    if (!v || !seg || !src) return;
    // Once past the footage, stay on its last frame rather than running on.
    const into = Math.min(ms - seg.startMs, seg.durationMs);
    const want = (into + (seg.sourceStartMs || 0)) / 1000;
    if (!Number.isFinite(want)) return;
    if (Math.abs(v.currentTime - want) > 0.25) {
      try { v.currentTime = want; } catch { /* seeking before metadata */ }
    }
  }, [ms, seg?.id, src]);

  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const holding = !!seg && ms >= seg.startMs + seg.durationMs;
    if (playing && seg && !holding) v.play().catch(() => {});
    else if (holding) v.pause();
    else v.pause();
  }, [playing, seg?.id, src]);

  useEffect(() => {
    const v = vidRef.current;
    if (v && seg) v.playbackRate = seg.speed || 1;
  }, [seg?.speed, src]);

  return (
    <>
      {src
        ? (
          <video
            ref={vidRef}
            className="canvas-video"
            src={src}
            muted={seg?.muteSourceAudio !== false}
            playsInline
            preload="auto"
            style={{
              // Crop first (inset), then scale and pan the remaining frame.
              clipPath: seg && (seg.cropTop || seg.cropRight || seg.cropBottom || seg.cropLeft)
                ? `inset(${(seg.cropTop || 0) * 100}% ${(seg.cropRight || 0) * 100}% ${(seg.cropBottom || 0) * 100}% ${(seg.cropLeft || 0) * 100}%)`
                : undefined,
              transform: seg && (seg.scale !== undefined && seg.scale !== 1) || seg?.x || seg?.y
                ? `translate(${((seg?.x || 0) / CANVAS_W) * 100}%, ${((seg?.y || 0) / CANVAS_H) * 100}%) scale(${seg?.scale ?? 1})`
                : undefined,
            }}
          />
        )
        : (
          <div className="stage-empty">
            {problem
              ? <>
                  <span>{problem}</span>
                  <span className="stage-hint">Remove it from the Media panel, or upload it again.</span>
                </>
              : seg ? 'Loading…' : 'No footage yet'}
          </div>
        )}
      <CameraBubble />
    </>
  );
};
