import React from 'react';
import {
  AbsoluteFill, Sequence, Video, Audio, Img,
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

// ─── Main composition ───
export const ProductShowcase: React.FC<{ payload: ShowcasePayload }> = ({ payload }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Compute zoom transform for current frame
  const zoomEffects = (payload.effects || []).filter(
    (e): e is ZoomEffect => e.kind === 'zoom'
  );
  const { scale, originX, originY } = useZoomTransform(zoomEffects, frame, fps);

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

        {/* === CALLOUTS === */}
        {payload.callouts.map(c => (
          <Sequence
            key={c.id}
            from={msToFrames(c.startMs)}
            durationInFrames={msToFrames(c.durationMs)}
            name={`Callout: ${c.text?.substring(0, 20)}`}
          >
            <AbsoluteFill>
              <CalloutComp callout={c} />
            </AbsoluteFill>
          </Sequence>
        ))}

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
