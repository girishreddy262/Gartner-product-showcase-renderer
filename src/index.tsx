import { registerRoot } from 'remotion';
import { Composition } from 'remotion';
import React from 'react';
import { ProductShowcase } from './Root';
import type { ShowcasePayload } from './types';
import { tokens } from './tokens';

const FPS = 30;

// Default empty payload for preview
const defaultPayload: ShowcasePayload = {
  module: { name: 'Preview' },
  videos: [],
  audios: [],
  segments: [],
  audioPlacements: [],
  callouts: [],
  effects: [],
  textOverlays: [],
  jobId: 'preview',
};

function getTotalDuration(payload: ShowcasePayload): number {
  let maxMs = 0;
  for (const s of payload.segments) {
    const end = s.startMs + s.durationMs;
    if (end > maxMs) maxMs = end;
  }
  for (const c of payload.callouts) {
    const end = c.startMs + c.durationMs;
    if (end > maxMs) maxMs = end;
  }
  for (const t of payload.textOverlays || []) {
    const end = t.startMs + t.durationMs;
    if (end > maxMs) maxMs = end;
  }
  for (const e of payload.effects || []) {
    const end = e.startMs + e.durationMs;
    if (end > maxMs) maxMs = end;
  }
  return Math.max(maxMs, 1000);
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ProductShowcase"
        component={ProductShowcase}
        durationInFrames={30}
        fps={FPS}
        width={tokens.canvasW}
        height={tokens.canvasH}
        defaultProps={{ payload: defaultPayload }}
        calculateMetadata={({ props }) => {
          const p = props.payload || defaultPayload;
          const totalMs = getTotalDuration(p);
          const frames = Math.ceil((totalMs / 1000) * FPS);
          return { durationInFrames: frames, props };
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
