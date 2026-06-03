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

  const sourceStartFrames = Math.round(((seg.sourceStartMs || 0) / 1000) * FPS);

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
        {/* v3.28b.94 Fix #1: trim the source via a negative-`from` Sequence
            instead of OffthreadVideo's `startFrom`. `startFrom` shifts the
            video's frame mapping; during the outer sequence's premount window
            (negative local frames) that offset could resolve to an out-of-range
            / not-yet-decoded source frame and paint ONE black frame at the cut
            seam — the blink. With trim-by-Sequence, OffthreadVideo always plays
            from source frame 0 forward and the inner Sequence shifts its clock
            by -sourceStartFrames, so frame 0 of OffthreadVideo aligns to
            sourceStartMs. premount-safe: no offset to mis-resolve. `layout="none"`
            keeps the Sequence from adding a wrapping div that would disturb the
            scale/position styles. */}
        <Sequence from={-sourceStartFrames} layout="none">
          <OffthreadVideo
            src={video.url}
            playbackRate={seg.speed || 1.0}
            muted={seg.muteSourceAudio !== false}
            style={{
              width: '100%', height: '100%', objectFit: 'contain',
              transform: _vScale !== 1.0 ? `scale(${_vScale})` : undefined,
              transformOrigin: 'center center',
            }}
          />
        </Sequence>
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
          // v3.28b.94 Fix #3: derive duration from the ABSOLUTE end, not the
          // standalone duration. round(start) + round(dur) can differ from
          // round(end) by 1 frame, leaving a 1-frame seam (overlap or gap) at
          // the cut even when the editor tiled the ms perfectly. Computing
          // round(end) - round(start) makes this segment's end frame equal
          // round(end), which equals the next segment's round(start) — exact
          // tiling, no seam, no intermittent black frame at the cut.
          const durFrames = msToFrames(seg.startMs + seg.durationMs) - startFrame;
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
              // v3.28b.93: premountFor=15 per the proven recipe in notes.
              // 15 frames (~500ms at 30fps) gives FFmpeg enough lead time to
              // extract the first frame of the upcoming sequence before its
              // visible window opens, so cut boundaries paint the correct
              // frame immediately instead of the wrapper bg. With
              // OffthreadVideo (no persistent decoder), this premount does
              // NOT cause the Lambda-resource-contention timeouts seen
              // earlier with <Video>.
              premountFor={15}
              name={isRecording ? `Recording: ${(seg as RecordingSegment).videoId}` : `Slide: ${seg.kind}`}
            >
              {isRecording
                ? <RecordingComp seg={seg as RecordingSegment} videos={payload.videos} />
                : <SlideComp seg={seg as SlideSegment} headerOpacity={headerOpacity} />
              }
            </Sequence>
          );
        })}

        {/* === CALLOUTS moved OUTSIDE the zoom wrap (v3.28b.90) — see siblings
            block below. Empty here to keep file structure clear. === */}

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

        {/* === CUSTOMER CARDS moved OUTSIDE the zoom wrap (v3.28b.90) — see
            siblings block below. === */}

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
        // v3.28b.94 Fix #3: same end-derived duration so the frame bezel tiles
        // with its recording segment instead of leaving a 1-frame seam.
        const durFrames = msToFrames(seg.startMs + seg.durationMs) - startFrame;
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

      {/* === CALLOUTS — siblings of the zoom wrap, NEVER transformed by the
          playback zoom effect (v3.28b.90). Mirrors editor.html stageOverlayLayer
          which keeps callouts at canvas dimensions while the underlying video
          zooms beneath them. Each callout is gated by its own Sequence. === */}
      {payload.callouts.map(c => {
        const startFrame = msToFrames(c.startMs);
        const durFrames = msToFrames(c.durationMs);
        return (
          <Sequence
            key={`overlay-callout-${c.id}`}
            from={startFrame}
            durationInFrames={durFrames}
            name={`Callout: ${c.text?.substring(0, 20)}`}
          >
            <AbsoluteFill style={{ pointerEvents: 'none' }}>
              <CalloutComp
                callout={c}
                startFrame={startFrame}
                durationFrames={durFrames}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* === CUSTOMER CARDS — siblings of the zoom wrap, NEVER transformed by
          the playback zoom effect (v3.28b.90). Same rule as callouts above. === */}
      {(payload.customerCards || []).map(c => {
        const startFrame = msToFrames(c.startMs);
        const durFrames = msToFrames(c.durationMs);
        return (
          <Sequence
            key={`overlay-card-${c.id}`}
            from={startFrame}
            durationInFrames={durFrames}
            name={`CustomerCard: ${c.employees || ''}`}
          >
            <AbsoluteFill style={{ pointerEvents: 'none' }}>
              <CustomerCardComp
                card={c}
                startFrame={startFrame}
                durationFrames={durFrames}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* === AUDIO PLACEMENTS === */}
      {payload.audioPlacements.map(ap => {
        const audioMeta = payload.audios.find(a => a.id === ap.audioId);
        if (!audioMeta) return null;
        // v3.28b.88: respect sourceStartMs so cut/sliced audio clips play from the
        // correct offset inside the source file instead of restarting at 0:00 each
        // time. Without `startFrom`, every cut piece replays the head of the audio,
        // causing the audible repeat the user reported.
        const sourceStartFrames = msToFrames(ap.sourceStartMs || 0);
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
              startFrom={sourceStartFrames}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
