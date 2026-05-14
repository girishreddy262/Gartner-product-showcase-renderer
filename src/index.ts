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

// Read payload from env or use default
function getPayload(): ShowcasePayload {
  try {
    const raw = process.env.REMOTION_PAYLOAD;
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultPayload;
}

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
  // Minimum 1 second
  return Math.max(maxMs, 1000);
}

export const RemotionRoot: React.FC = () => {
  const payload = getPayload();
  const totalMs = getTotalDuration(payload);
  const durationInFrames = Math.ceil((totalMs / 1000) * FPS);

  return (
    <>
      <Composition
        id="ProductShowcase"
        component={ProductShowcase}
        durationInFrames={durationInFrames}
        fps={FPS}
        width={tokens.canvasW}
        height={tokens.canvasH}
        defaultProps={{ payload }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
