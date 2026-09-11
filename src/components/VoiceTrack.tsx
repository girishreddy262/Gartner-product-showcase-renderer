import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/project';
import { signedUrl } from '../lib/api';

/**
 * Plays the generated voice for whichever block the playhead is inside.
 * Without this the voiceover could be generated but never heard, so the
 * preview lied about what the export would contain.
 */
export const VoiceTrack: React.FC = () => {
  const blocks = useStore((s) => s.project.blocks);
  const playhead = useStore((s) => s.playheadMs);
  const playing = useStore((s) => s.playing);
  const el = useRef<HTMLAudioElement>(null);
  const currentId = useRef<string>('');

  // Which block owns this moment, and how far into it we are.
  let at = 0;
  let block: (typeof blocks)[number] | undefined;
  let offsetMs = 0;
  for (const b of blocks) {
    if (playhead >= at && playhead < at + b.durationMs) { block = b; offsetMs = playhead - at; break; }
    at += b.durationMs;
  }

  // After a reload the blob is gone but the stored copy is not, so resolve
  // that instead rather than playing silence.
  const [keyed, setKeyed] = useState('');
  const wantKey = !block?.audioUrl && block?.audioKey ? block.audioKey : '';

  useEffect(() => {
    let alive = true;
    if (!wantKey) { setKeyed(''); return; }
    void signedUrl(wantKey).then((u) => { if (alive) setKeyed(u); }).catch(() => { if (alive) setKeyed(''); });
    return () => { alive = false; };
  }, [wantKey]);

  const src = block && !block.dirty ? (block.audioUrl || keyed) : '';

  useEffect(() => {
    const a = el.current;
    if (!a) return;
    if (!src) { a.pause(); currentId.current = ''; return; }

    if (currentId.current !== block!.id) {
      currentId.current = block!.id;
      a.src = src;
    }
    a.volume = Math.max(0, Math.min(1, block!.volume ?? 1));
    a.playbackRate = block!.speed ?? 1;

    // Only chase the playhead when it has genuinely drifted, otherwise every
    // frame would reset currentTime and the audio would stutter.
    const want = offsetMs / 1000;
    if (Math.abs(a.currentTime - want) > 0.25) a.currentTime = want;

    if (playing) void a.play().catch(() => {});
    else a.pause();
  }, [src, block?.id, block?.volume, block?.speed, playing, offsetMs]);

  return <audio ref={el} preload="auto" aria-hidden="true" />;
};
