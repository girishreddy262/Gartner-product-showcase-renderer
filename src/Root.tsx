import React from 'react';
import {
  AbsoluteFill, Sequence, Video, OffthreadVideo, Audio, Img,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import type {
  ShowcasePayload, Segment, RecordingSegment, SlideSegment,
  ZoomEffect, SpotlightEffect,
} from './types';
import { tokens, satoshiFontFaceCSS } from './tokens';
import { SlideRenderer } from './slides/SlideRenderer';
import { TextOverlayComp } from './overlays/TextOverlay';
import { CalloutComp } from './overlays/Callout';
import { CustomerCardComp } from './overlays/CustomerCard';
import { useZoomTransform, SpotlightComp } from './effects/Effects';
import { ASSETS } from './assets';

const FPS = 30;

function msToFrames(ms: number): number {
  return Math.round((ms / 1000) * FPS);
}

// ─── Recording segment component ───
const RecordingComp: React.FC<{
  seg: RecordingSegment;
  videos: ShowcasePayload['videos'];
}> = ({ seg, videos }) => {
  const video = videos.find(v => v.id === seg.videoId);
  if (!video) return <AbsoluteFill style={{ background: '#000' }} />;

  const sourceStartSec = (seg.sourceStartMs || 0) / 1000;

  // v3.28b.XX: mirror editor formula exactly (editor.html line 6231-6238).
  // Editor applies CSS `transform: scale(_vScale)` with `transform-origin:
  // center center` to the <video> element only; the frame overlay is a sibling
  // at the full canvas and does NOT scale. We do the same here so the rendered
  // MP4 matches the editor preview at any videoScale value (50-150%).
  const _vScale = (seg.videoScale != null && seg.videoScale > 0) ? seg.videoScale : 1.0;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute',
        left: seg.x || 0,
        top: seg.y || 0,
        width: seg.width || tokens.canvasW,
        height: seg.height || tokens.canvasH,
        overflow: 'hidden',
        // v3.28b.XX: match editor.html line 6184 — wrap.style.background = '#002B54'.
        // Was '#000', which produced a visible black band around the video when
        // videoScale < 100% (the gap between the scaled video and the frame's
        // inner edge revealed the wrapper bg). Navy blends with the slide bg
        // exactly as the editor preview does.
        background: '#002B54',
      }}>
        <OffthreadVideo
          src={video.url}
          startFrom={Math.round(sourceStartSec * FPS)}
          playbackRate={seg.speed || 1.0}
          muted={seg.muteSourceAudio !== false}
          style={{
            width: '100%', height: '100%', objectFit: 'contain',
            transform: _vScale !== 1.0 ? `scale(${_vScale})` : undefined,
            transformOrigin: 'center center',
          }}
        />
        {/* v3.28b.XX: frame moved OUT of this wrap, rendered as a sibling of
            the zoom-transform canvas in ProductShowcase below. Matches editor's
            stageFrameLayer design (editor.html line 5962-5978, v3.28b.13) so
            the frame stays at canvas dimensions when zoom effects fire. */}
      </div>
    </AbsoluteFill>
  );
};

// ─── Slide segment component ───
const SlideComp: React.FC<{ seg: SlideSegment; headerOpacity?: number }> = ({ seg, headerOpacity }) => {
  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute',
        left: seg.x || 0,
        top: seg.y || 0,
        width: seg.width || tokens.canvasW,
        height: seg.height || tokens.canvasH,
        overflow: 'hidden',
        background: tokens.navy900,
      }}>
        <SlideRenderer seg={seg} headerOpacity={headerOpacity} />
      </div>
    </AbsoluteFill>
  );
};

// ─── Main composition ───
export const ProductShowcase: React.FC<{ payload: ShowcasePayload }> = ({ payload }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Compute zoom transform for current frame
  const zoomEffects = (payload.effects || []).filter(
    (e): e is ZoomEffect => e.kind === 'zoom'
  );
  const { scale, tx, ty } = useZoomTransform(zoomEffects, frame, fps);

  // Active spotlights for current frame
  const currentMs = (frame / fps) * 1000;
  const activeSpotlights = (payload.effects || []).filter(
    (e): e is SpotlightEffect =>
      e.kind === 'spotlight' &&
      currentMs >= e.startMs &&
      currentMs < e.startMs + e.durationMs
  );

  return (
    <AbsoluteFill style={{ backgroundColor: tokens.navy900 }}>
      {/* Font loading */}
      <style dangerouslySetInnerHTML={{
        __html: satoshiFontFaceCSS(ASSETS.fonts),
      }} />

      {/* Main canvas with zoom transform — v3.28b.83: translate focal-to-center
          + scale, origin 0 0 (matches editor preview exactly). */}
      <div style={{
        width: tokens.canvasW,
        height: tokens.canvasH,
        position: 'relative',
        transform: scale !== 1
          ? `translate(${tx}px, ${ty}px) scale(${scale})`
          : 'none',
        transformOrigin: '0 0',
      }}>
        {/* === SEGMENTS === */}
        {payload.segments.map(seg => {
          const startFrame = msToFrames(seg.startMs);
          const durFrames = msToFrames(seg.durationMs);
          const isRecording = seg.kind === 'recording';

          // Compute headerOpacity for slide segments based on zoom effect overlap.
          // If any zoom effect overlaps this slide's time range, fade header out as
          // the zoom enters and back in as it exits. 300ms fade on each side.
          let headerOpacity = 1;
          if (!isRecording && (seg.kind === 'slide-journey')) {
            const segStartMs = seg.startMs;
            const segEndMs = seg.startMs + seg.durationMs;
            const curMs = (frame / fps) * 1000;
            // Find the zoom effect that overlaps the slide AND covers the current frame
            for (const z of zoomEffects) {
              const zStart = z.startMs;
              const zEnd = z.startMs + z.durationMs;
              // Effect must overlap the slide at all
              if (zEnd <= segStartMs || zStart >= segEndMs) continue;
              // Clip the zoom's "active period" to within the slide
              const activeStart = Math.max(zStart, segStartMs);
              const activeEnd = Math.min(zEnd, segEndMs);
              const fadeMs = 300; // fade duration
              if (curMs >= activeStart && curMs <= activeEnd) {
                // Inside the active period: 1 outside the fades, 0 in the middle.
                const intoFade = curMs - activeStart;        // ms since zoom started
                const beforeEnd = activeEnd - curMs;          // ms before zoom ends
                const fadeIn = Math.min(1, intoFade / fadeMs);     // 0 → 1 over first 300ms
                const fadeOut = Math.min(1, beforeEnd / fadeMs);   // 1 → 0 over last 300ms
                // Header should be hidden in the middle: visible (1) at edges, hidden (0) in middle.
                // hiddenness = min(fadeIn, fadeOut) → 0 at edges, 1 fully into the zoom
                const hiddenness = Math.min(fadeIn, fadeOut);
                headerOpacity = Math.min(headerOpacity, 1 - hiddenness);
              }
            }
          }

          return (
            <Sequence
              key={seg.id}
              from={startFrame}
              durationInFrames={durFrames}
              // v3.28b.87: premount video segments so the <Video> is mounted and the
              // source frame is decoded BEFORE this sequence becomes visible. Without
              // this, the first frame(s) of each clip show the black wrapper background
              // while the video seeks/decodes — the black flash at every cut/speed
              // boundary. 15 frames (~0.5s at 30fps) is ample lead time. Slides don't
              // need it but premounting them is harmless.
              premountFor={5}
              name={isRecording ? `Recording: ${(seg as RecordingSegment).videoId}` : `Slide: ${seg.kind}`}
            >
              {isRecording
                ? <RecordingComp seg={seg as RecordingSegment} videos={payload.videos} />
                : <SlideComp seg={seg as SlideSegment} headerOpacity={headerOpacity} />
              }
            </Sequence>
          );
        })}

        {/* === CALLOUTS === */}
        {payload.callouts.map(c => {
          const startFrame = msToFrames(c.startMs);
          const durFrames = msToFrames(c.durationMs);
          return (
            <Sequence
              key={c.id}
              from={startFrame}
              durationInFrames={durFrames}
              name={`Callout: ${c.text?.substring(0, 20)}`}
            >
              <AbsoluteFill>
                <CalloutComp
                  callout={c}
                  startFrame={startFrame}
                  durationFrames={durFrames}
                />
              </AbsoluteFill>
            </Sequence>
          );
        })}

        {/* === TEXT OVERLAYS === */}
        {(payload.textOverlays || []).map(t => {
          const startFrame = msToFrames(t.startMs);
          const durFrames = msToFrames(t.durationMs);
          return (
            <Sequence
              key={t.id}
              from={startFrame}
              durationInFrames={durFrames}
              name={`Text: ${t.text?.substring(0, 20)}`}
            >
              <AbsoluteFill>
                <TextOverlayComp
                  overlay={t}
                  startFrame={startFrame}
                  durationFrames={durFrames}
                />
              </AbsoluteFill>
            </Sequence>
          );
        })}

        {/* === CUSTOMER CARD OVERLAYS === */}
        {(payload.customerCards || []).map(c => {
          const startFrame = msToFrames(c.startMs);
          const durFrames = msToFrames(c.durationMs);
          return (
            <Sequence
              key={c.id}
              from={startFrame}
              durationInFrames={durFrames}
              name={`CustomerCard: ${c.employees || ''}`}
            >
              <AbsoluteFill>
                <CustomerCardComp
                  card={c}
                  startFrame={startFrame}
                  durationFrames={durFrames}
                />
              </AbsoluteFill>
            </Sequence>
          );
        })}

        {/* === SPOTLIGHTS === */}
        {activeSpotlights.map(sp => (
          <SpotlightComp key={sp.id} spotlight={sp} />
        ))}
      </div>

      {/* === RECORDING FRAME OVERLAYS — siblings of the zoom wrap, NEVER
          transformed. Mirrors editor.html stageFrameLayer (v3.28b.13): "Frame
          overlay goes to the FRAME LAYER (sibling of stage-inner) so the
          playback zoom effect that transforms stage-inner doesn't scale the
          frame — frame stays at canvas dimensions." Each frame is gated by
          its own Sequence so it appears only during that recording segment.
          Full canvas dims (1920×1080) regardless of segment box size, matching
          editor.html lines 5970-5973. === */}
      {payload.segments.map(seg => {
        if (seg.kind !== 'recording') return null;
        const r = seg as RecordingSegment;
        if (r.showFrame === false) return null;
        const startFrame = msToFrames(seg.startMs);
        const durFrames = msToFrames(seg.durationMs);
        return (
          <Sequence
            key={`frame-${seg.id}`}
            from={startFrame}
            durationInFrames={durFrames}
            name={`Frame: ${seg.id}`}
          >
            <AbsoluteFill style={{ pointerEvents: 'none' }}>
              <Img
                src={ASSETS.videoFrame}
                style={{
                  position: 'absolute',
                  left: 0, top: 0,
                  width: tokens.canvasW,
                  height: tokens.canvasH,
                  objectFit: 'fill',
                  pointerEvents: 'none',
                }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* === AUDIO PLACEMENTS === */}
      {payload.audioPlacements.map(ap => {
        const audioMeta = payload.audios.find(a => a.id === ap.audioId);
        if (!audioMeta) return null;
        // v3.28b.XX: honor ap.sourceStartMs so cut audio halves play from
        // the correct source offset (mirrors editor.html line 10008
        // syncAudioPlayback: `const sourceOffsetMs = ap.sourceStartMs || 0`).
        // Without this, the second half of any cut audio replays from second 0
        // of the source — sounds like the first half repeating in the render
        // even though the timeline shows two distinct clips.
        const sourceStartSec = (ap.sourceStartMs || 0) / 1000;
        const audioStartFromFrames = Math.round(sourceStartSec * FPS);
        return (
          <Sequence
            key={ap.id}
            from={msToFrames(ap.startMs)}
            durationInFrames={msToFrames(ap.durationMs)}
            name={`Audio: ${ap.audioId}`}
          >
            <Audio
              src={audioMeta.url}
              volume={ap.volume ?? 1}
              startFrom={audioStartFromFrames}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
