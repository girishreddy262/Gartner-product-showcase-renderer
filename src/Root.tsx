import React from 'react';
import {
  AbsoluteFill, Sequence, Video, Audio,
  useCurrentFrame, useVideoConfig,
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
  const { scale, originX, originY } = useZoomTransform(zoomEffects, frame, fps);

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
        transform: scale !== 1 ? `scale(${scale})` : 'none',
        transformOrigin: `${originX}px ${originY}px`,
      }}>
        {payload.segments.map(seg => {
          const startFrame = msToFrames(seg.startMs);
          const durFrames = msToFrames(seg.durationMs);
          const isRecording = seg.kind === 'recording';

          return (
            <Sequence
              key={seg.id}
              from={startFrame}
              durationInFrames={durFrames}
              name={isRecording ? `Recording: ${(seg as RecordingSegment).videoId}` : `Slide: ${seg.kind}`}
            >
              {isRecording
                ? <RecordingComp seg={seg as RecordingSegment} videos={payload.videos} />
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
              <AbsoluteFill>
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
              <AbsoluteFill>
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
              <AbsoluteFill>
                <CustomerCardComp card={c} startFrame={startFrame} durationFrames={durFrames} />
              </AbsoluteFill>
            </Sequence>
          );
        })}

        {activeSpotlights.map(sp => (
          <SpotlightComp key={sp.id} spotlight={sp} />
        ))}
      </div>

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
            <Audio src={audioMeta.url} volume={ap.volume ?? 1} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
