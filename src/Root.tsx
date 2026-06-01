import React from 'react';
import {
  AbsoluteFill, Sequence, Video, Audio,
  useCurrentFrame, useVideoConfig, interpolate, Easing,
} from 'remotion';
import type {
  ShowcasePayload, Segment, RecordingSegment, SlideSegment,
  ZoomEffect, SpotlightEffect, JourneySegment, ImageSegment,
  ShapeOverlay,
} from './types';
import { tokens, satoshiFontFaceCSS } from './tokens';
import { SlideRenderer } from './slides/SlideRenderer';
import { TextOverlayComp } from './overlays/TextOverlay';
import { CalloutComp } from './overlays/Callout';
import { CustomerCardComp } from './overlays/CustomerCard';
import { useZoomTransform, SpotlightComp } from './effects/Effects';
import { Img } from 'remotion';
import { ASSETS } from './assets';

const FPS = 30;

function msToFrames(ms: number): number {
  return Math.round((ms / 1000) * FPS);
}

const RecordingComp: React.FC<{
  seg: RecordingSegment;
  videos: ShowcasePayload['videos'];
}> = ({ seg, videos }) => {
  const video = videos.find(v => v.id === seg.videoId);
  // v3.28b.5: navy bg so scale<1.0 shows brand color, not black
  if (!video) return <AbsoluteFill style={{ background: '#002B54' }} />;

  const sourceStartSec = (seg.sourceStartMs || 0) / 1000;
  // v3.28b.5: per-video scale, default 1.0
  const videoScale = (typeof seg.videoScale === 'number' && seg.videoScale > 0) ? seg.videoScale : 1.0;
  // v3.28b.5: default showFrame to TRUE if undefined (was false in v3.28b.4 and earlier)
  const showFrame = seg.showFrame !== false;

  // v3.28b.42: crop feature removed

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute',
        left: seg.x || 0,
        top: seg.y || 0,
        width: seg.width || tokens.canvasW,
        height: seg.height || tokens.canvasH,
        overflow: 'hidden',
        background: '#002B54',
      }}>
        <Video
          src={video.url}
          startFrom={Math.round(sourceStartSec * FPS)}
          playbackRate={seg.speed || 1.0}
          muted={seg.muteSourceAudio !== false}
          /* v3.28b.20: per-segment volume when source audio is enabled */
          volume={seg.muteSourceAudio === false ? (seg.audioVolume != null ? seg.audioVolume : 1.0) : 0}
          style={{
            width: '100%', height: '100%', objectFit: 'contain',
            transform: videoScale !== 1.0 ? `scale(${videoScale})` : 'none',
            transformOrigin: 'center center',
          }}
        />
      </div>
      {/* v3.28b.13: Frame overlay is now rendered at the OUTER level (in
          ProductShowcase) so it sits OUTSIDE the zoom-transformed wrapper.
          The playback zoom effect no longer scales the frame. */}
    </AbsoluteFill>
  );
};

const SlideComp: React.FC<{ seg: SlideSegment }> = ({ seg }) => {
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
        <SlideRenderer seg={seg} />
      </div>
    </AbsoluteFill>
  );
};

// v3.28b.5: full-bleed image slide with simple fade-in
// v3.28b.51: + optional scale (50-150%) for zoom-in effect like video segments
const ImageSlideComp: React.FC<{ seg: ImageSegment }> = ({ seg }) => {
  const frame = useCurrentFrame();
  // Fade-in over 18 frames (600ms at 30fps)
  const FADE_FRAMES = 18;
  const opacity = interpolate(frame, [0, FADE_FRAMES], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const imageScale = (seg.imageScale != null && seg.imageScale > 0) ? seg.imageScale : 1.0;

  return (
    <AbsoluteFill style={{ background: '#002B54' }}>
      <Img
        src={seg.imageUrl}
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          opacity,
          transform: imageScale !== 1.0 ? `scale(${imageScale})` : 'none',
          transformOrigin: 'center center',
        }}
      />
    </AbsoluteFill>
  );
};

// v3.28b.53: Shape component — renders SVG rect or ellipse with fill/stroke
const ShapeComp: React.FC<{ shape: ShapeOverlay }> = ({ shape }) => {
  const frame = useCurrentFrame();
  // Fade in/out matching callouts (300ms each side)
  const FADE_FRAMES = 9;
  const totalFrames = Math.max(1, Math.round((shape.durationMs / 1000) * 30));
  const opacityAnim = interpolate(
    frame,
    [0, FADE_FRAMES, totalFrames - FADE_FRAMES, totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }
  );
  const userOpacity = shape.opacity != null ? shape.opacity : 1;
  const finalOpacity = opacityAnim * userOpacity;
  const fillVal = shape.fillEnabled !== false && shape.fill ? shape.fill : 'none';
  const strokeVal = shape.strokeEnabled && shape.stroke ? shape.stroke : 'none';
  const strokeW = shape.strokeEnabled ? (shape.strokeWidth || 4) : 0;
  const inset = strokeW / 2;
  const w = shape.width - strokeW;
  const h = shape.height - strokeW;
  let inner: React.ReactNode;
  if (shape.shapeType === 'ellipse') {
    inner = (
      <ellipse
        cx={shape.width / 2}
        cy={shape.height / 2}
        rx={Math.max(0, w / 2)}
        ry={Math.max(0, h / 2)}
        fill={fillVal}
        stroke={strokeVal}
        strokeWidth={strokeW}
      />
    );
  } else {
    const r = Math.min(shape.cornerRadius || 0, w / 2, h / 2);
    inner = (
      <rect
        x={inset}
        y={inset}
        width={Math.max(0, w)}
        height={Math.max(0, h)}
        rx={r}
        ry={r}
        fill={fillVal}
        stroke={strokeVal}
        strokeWidth={strokeW}
      />
    );
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: shape.x,
        top: shape.y,
        width: shape.width,
        height: shape.height,
        opacity: finalOpacity,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${shape.width} ${shape.height}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {inner}
      </svg>
    </div>
  );
};

export const ProductShowcase: React.FC<{ payload: ShowcasePayload }> = ({ payload }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  // v3.22 — Journey-with-zoom segments handle their camera transform INTERNALLY.
  // Generic Zoom effects that fall entirely inside such a segment are dropped so
  // they don't double-apply. Other slides + generic Zoom continue to use the outer
  // canvas transform as before.
  const journeyZoomSegments = payload.segments.filter(
    (s): s is JourneySegment => s.kind === 'slide-journey' && !!s.journeyZoom?.enabled
  );
  const zoomEffects = (payload.effects || []).filter(
    (e): e is ZoomEffect => {
      if (e.kind !== 'zoom') return false;
      const eStart = e.startMs;
      const eEnd = e.startMs + e.durationMs;
      for (const js of journeyZoomSegments) {
        const jStart = js.startMs;
        const jEnd = js.startMs + js.durationMs;
        if (eStart >= jStart && eEnd <= jEnd) return false;
      }
      return true;
    }
  );
  const { scale, tx, ty } = useZoomTransform(zoomEffects, frame, fps);

  const activeSpotlights = (payload.effects || []).filter(
    (e): e is SpotlightEffect =>
      e.kind === 'spotlight' &&
      currentMs >= e.startMs &&
      currentMs < e.startMs + e.durationMs
  );

  return (
    <AbsoluteFill style={{ backgroundColor: tokens.navy900 }}>
      <style dangerouslySetInnerHTML={{
        __html: satoshiFontFaceCSS(ASSETS.fonts),
      }} />

      <div style={{
        width: tokens.canvasW,
        height: tokens.canvasH,
        position: 'relative',
        transform: scale !== 1 ? `translate(${tx}px, ${ty}px) scale(${scale})` : 'none',
        transformOrigin: '0 0',
      }}>
        {payload.segments.map(seg => {
          const startFrame = msToFrames(seg.startMs);
          const durFrames = msToFrames(seg.durationMs);
          const isRecording = seg.kind === 'recording';
          const isImage = seg.kind === 'slide-image';

          return (
            <Sequence
              key={seg.id}
              from={startFrame}
              durationInFrames={durFrames}
              name={
                isRecording ? `Recording: ${(seg as RecordingSegment).videoId}` :
                isImage ? `Image: ${(seg as ImageSegment).filename || 'custom'}` :
                `Slide: ${seg.kind}`
              }
            >
              {isRecording
                ? <RecordingComp seg={seg as RecordingSegment} videos={payload.videos} />
                : isImage
                  ? <ImageSlideComp seg={seg as ImageSegment} />
                  : <SlideComp seg={seg as SlideSegment} />
              }
            </Sequence>
          );
        })}

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
              <AbsoluteFill style={{ zIndex: 28 }}>
                <CalloutComp callout={c} startFrame={startFrame} durationFrames={durFrames} />
              </AbsoluteFill>
            </Sequence>
          );
        })}

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
              <AbsoluteFill style={{ zIndex: 30 }}>
                <TextOverlayComp overlay={t} startFrame={startFrame} durationFrames={durFrames} />
              </AbsoluteFill>
            </Sequence>
          );
        })}

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
              <AbsoluteFill style={{ zIndex: 26 }}>
                <CustomerCardComp card={c} startFrame={startFrame} durationFrames={durFrames} />
              </AbsoluteFill>
            </Sequence>
          );
        })}

        {/* v3.28b.53: Shapes (rect/ellipse) with fill+stroke */}
        {(payload.shapes || []).map(s => {
          const startFrame = msToFrames(s.startMs);
          const durFrames = msToFrames(s.durationMs);
          return (
            <Sequence
              key={s.id}
              from={startFrame}
              durationInFrames={durFrames}
              name={`Shape: ${s.shapeType}`}
            >
              <AbsoluteFill style={{ zIndex: 10 }}>
                <ShapeComp shape={s} />
              </AbsoluteFill>
            </Sequence>
          );
        })}

        {activeSpotlights.map(sp => (
          <SpotlightComp key={sp.id} spotlight={sp} />
        ))}
      </div>

      {/* v3.28b.13: Frame overlay sits OUTSIDE the zoom-transformed div so the
          playback zoom effect doesn't scale the frame. We find the currently
          active recording segment OR image slide at this frame and apply showFrame.
          v3.28b.51: image slides also support optional frame (default OFF). */}
      {(() => {
        const activeFrameSeg = payload.segments.find(s => {
          if (currentMs < s.startMs || currentMs >= s.startMs + s.durationMs) return false;
          if (s.kind === 'recording') {
            return (s as RecordingSegment).showFrame !== false;
          }
          if (s.kind === 'slide-image') {
            return (s as ImageSegment).showFrame === true;
          }
          return false;
        });
        if (!activeFrameSeg) return null;
        return (
          <Img
            src={ASSETS.videoFrame}
            style={{
              position: 'absolute',
              left: 0, top: 0,
              width: tokens.canvasW, height: tokens.canvasH,
              objectFit: 'fill',
              pointerEvents: 'none',
            }}
          />
        );
      })()}

      {payload.audioPlacements.map(ap => {
        const audioMeta = payload.audios.find(a => a.id === ap.audioId);
        if (!audioMeta) return null;
        // v3.28b.50: sliced audio uses sourceStartMs to skip into the file
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
              startFrom={sourceStartFrames > 0 ? sourceStartFrames : undefined}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
