import React from 'react';
import {
  AbsoluteFill, Sequence, Video, Audio, Img,
  useCurrentFrame, useVideoConfig, interpolate, Easing,
} from 'remotion';
import type {
  ShowcasePayload, Segment, RecordingSegment, SlideSegment,
  ZoomEffect, SpotlightEffect, JourneySegment,
} from './types';
import { tokens, satoshiFontFaceCSS } from './tokens';
import { SlideRenderer } from './slides/SlideRenderer';
import { TextOverlayComp } from './overlays/TextOverlay';
import { CalloutComp } from './overlays/Callout';
import { CustomerCardComp } from './overlays/CustomerCard';
import { useZoomTransform, SpotlightComp } from './effects/Effects';
import { ASSETS } from './assets';

const FPS = 30;

// v3.21 — native Journey camera zoom timing. Deterministic ramp tied to the segment.
const JOURNEY_ZOOM_RAMP_MS = 600; // 0.6s ease-in / ease-out (matches generic Zoom feel)

function msToFrames(ms: number): number {
  return Math.round((ms / 1000) * FPS);
}

/**
 * Compute the camera transform contributed by a Journey segment's native zoom (seg.journeyZoom).
 * Returns scale=1 + zoomProgress=0 when zoom is disabled or the playhead is outside the segment.
 * Ramp in over JOURNEY_ZOOM_RAMP_MS at the start, ramp out at the end. Hold at full zoom in between.
 */
function computeJourneyNativeZoom(
  seg: JourneySegment,
  currentMs: number,
): { scale: number; originX: number; originY: number; zoomProgress: number } {
  const z = seg.journeyZoom;
  const defaults = { scale: 1, originX: tokens.canvasW / 2, originY: tokens.canvasH / 2, zoomProgress: 0 };
  if (!z || !z.enabled) return defaults;
  const segStart = seg.startMs;
  const segEnd = seg.startMs + seg.durationMs;
  if (currentMs < segStart || currentMs >= segEnd) return defaults;

  const segDur = segEnd - segStart;
  // Cap ramp at 40% of segment duration on each side so short segments still hold briefly.
  const ramp = Math.min(JOURNEY_ZOOM_RAMP_MS, Math.floor(segDur * 0.4));
  const into = currentMs - segStart;
  const before = segEnd - currentMs;

  // Smoothstep-ish ease (matches Easing.bezier(0.42, 0, 0.58, 1) in feel).
  const ease = (t: number) => {
    const c = Math.max(0, Math.min(1, t));
    return c * c * (3 - 2 * c);
  };

  let progress = 1;
  if (into < ramp) progress = ease(into / ramp);
  else if (before < ramp) progress = ease(before / ramp);
  // else: full hold (progress = 1)

  const targetScale = z.scale || 1.4;
  const scale = 1 + (targetScale - 1) * progress;
  return { scale, originX: z.focalX, originY: z.focalY, zoomProgress: progress };
}

// ─── Recording segment component ───
const RecordingComp: React.FC<{
  seg: RecordingSegment;
  videos: ShowcasePayload['videos'];
}> = ({ seg, videos }) => {
  const video = videos.find(v => v.id === seg.videoId);
  if (!video) return <AbsoluteFill style={{ background: '#000' }} />;

  const sourceStartSec = (seg.sourceStartMs || 0) / 1000;

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute',
        left: seg.x || 0,
        top: seg.y || 0,
        width: seg.width || tokens.canvasW,
        height: seg.height || tokens.canvasH,
        overflow: 'hidden',
        background: '#000',
      }}>
        <Video
          src={video.url}
          startFrom={Math.round(sourceStartSec * FPS)}
          playbackRate={seg.speed || 1.0}
          muted={seg.muteSourceAudio !== false}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
        {seg.showFrame && (
          <Img
            src={ASSETS.videoFrame}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', objectFit: 'fill',
              pointerEvents: 'none',
            }}
          />
        )}
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
  const currentMs = (frame / fps) * 1000;

  // v3.21 — Find any Journey segment currently under the playhead with native zoom enabled.
  // When present, its zoom REPLACES any generic ZoomEffect contribution for the same period,
  // and drives the slide's header fade deterministically.
  const activeJourneyWithZoom: JourneySegment | undefined = payload.segments.find(
    (s): s is JourneySegment =>
      s.kind === 'slide-journey' &&
      !!s.journeyZoom?.enabled &&
      currentMs >= s.startMs &&
      currentMs < s.startMs + s.durationMs
  );

  const journeyZoom = activeJourneyWithZoom
    ? computeJourneyNativeZoom(activeJourneyWithZoom, currentMs)
    : null;

  // Generic zoom effects — exclude any that overlap a journey segment with native zoom enabled
  // (otherwise they'd double-apply). Other slides keep using the generic Zoom unchanged.
  const journeyZoomSegments = payload.segments.filter(
    (s): s is JourneySegment => s.kind === 'slide-journey' && !!s.journeyZoom?.enabled
  );
  const zoomEffects = (payload.effects || []).filter(
    (e): e is ZoomEffect => {
      if (e.kind !== 'zoom') return false;
      const eStart = e.startMs;
      const eEnd = e.startMs + e.durationMs;
      // Drop the effect if it falls entirely within any journey segment that has native zoom on.
      for (const js of journeyZoomSegments) {
        const jStart = js.startMs;
        const jEnd = js.startMs + js.durationMs;
        if (eStart >= jStart && eEnd <= jEnd) return false;
      }
      return true;
    }
  );
  const generic = useZoomTransform(zoomEffects, frame, fps);

  // Resolve final scale + origin. Native journey zoom wins when active.
  const scale = journeyZoom ? journeyZoom.scale : generic.scale;
  const originX = journeyZoom ? journeyZoom.originX : generic.originX;
  const originY = journeyZoom ? journeyZoom.originY : generic.originY;

  // Active spotlights for current frame
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

      {/* Main canvas with zoom transform */}
      <div style={{
        width: tokens.canvasW,
        height: tokens.canvasH,
        position: 'relative',
        transform: scale !== 1
          ? `scale(${scale})`
          : 'none',
        transformOrigin: `${originX}px ${originY}px`,
      }}>
        {/* === SEGMENTS === */}
        {payload.segments.map(seg => {
          const startFrame = msToFrames(seg.startMs);
          const durFrames = msToFrames(seg.durationMs);
          const isRecording = seg.kind === 'recording';

          // Compute headerOpacity for Journey slide segments.
          // v3.21: If the segment has native zoom enabled, header fades deterministically
          // with the zoom progress (1 - progress). Otherwise fall back to the old overlap
          // logic with generic ZoomEffects (300ms fade on each side).
          let headerOpacity = 1;
          if (!isRecording && seg.kind === 'slide-journey') {
            const js = seg as JourneySegment;
            if (js.journeyZoom?.enabled) {
              // Native zoom — header opacity tied directly to zoom progress
              const z = computeJourneyNativeZoom(js, currentMs);
              headerOpacity = 1 - z.zoomProgress;
            } else {
              const segStartMs = seg.startMs;
              const segEndMs = seg.startMs + seg.durationMs;
              const curMs = (frame / fps) * 1000;
              for (const z of zoomEffects) {
                const zStart = z.startMs;
                const zEnd = z.startMs + z.durationMs;
                if (zEnd <= segStartMs || zStart >= segEndMs) continue;
                const activeStart = Math.max(zStart, segStartMs);
                const activeEnd = Math.min(zEnd, segEndMs);
                const fadeMs = 300;
                if (curMs >= activeStart && curMs <= activeEnd) {
                  const intoFade = curMs - activeStart;
                  const beforeEnd = activeEnd - curMs;
                  const fadeIn = Math.min(1, intoFade / fadeMs);
                  const fadeOut = Math.min(1, beforeEnd / fadeMs);
                  const hiddenness = Math.min(fadeIn, fadeOut);
                  headerOpacity = Math.min(headerOpacity, 1 - hiddenness);
                }
              }
            }
          }

          return (
            <Sequence
              key={seg.id}
              from={startFrame}
              durationInFrames={durFrames}
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

      {/* === AUDIO PLACEMENTS === */}
      {payload.audioPlacements.map(ap => {
        const audioMeta = payload.audios.find(a => a.id === ap.audioId);
        if (!audioMeta) return null;
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
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
