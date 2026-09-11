import React from 'react';
import { useStore, setVoiceSettings } from '../store/project';
import type { Stability } from '../store/types';
import { Slider, ChoiceRow } from './ui/Controls';

const STABILITY: { key: Stability; label: string }[] = [
  { key: 'creative', label: 'Creative' },
  { key: 'natural', label: 'Natural' },
  { key: 'robust', label: 'Robust' },
];


/** ElevenLabs parameters. The voices come from ElevenLabs, so these are its
 *  controls, not a generic set. */
export const VoicePanel: React.FC<{ embedded?: boolean; onChangeVoice?: () => void }> = ({ embedded, onChangeVoice }) => {
  const v = useStore((s) => s.project.voiceSettings);

  // The name shown must be the voice actually in use; this was hardcoded to
  // "Sarah" and quietly lied whenever the voice changed.
  const full = v.voiceName || '';
  const who = full.split(/\s+[-\u2013\u2014]\s+/)[0].trim() || 'No voice chosen';
  const desc = full.split(/\s+[-\u2013\u2014]\s+/)[1] || 'Pick a voice';

  return (
    <div className={embedded ? 'vset-body' : 'panel-body'}>
      <div className="row row-voice">
        <span className="voice-dot" />
        <span className="row-label">
          <b>{who}</b>
          <em>{desc}</em>
        </span>
        <button className="choice" onClick={onChangeVoice}>Change</button>
      </div>

      <ChoiceRow
        label="Stability"
        hint="How closely each take matches the last. Creative varies more, Robust repeats more."
        value={v.stability}
        options={STABILITY.map((s) => ({ key: s.key, label: s.label }))}
        onChange={(k) => setVoiceSettings({ stability: k as Stability })}
      />

      <Slider
        label="Similarity" hint="How closely the result sticks to the original voice."
        value={v.similarity} min={0} max={1} step={0.01}
        format={(n) => `${Math.round(n * 100)}%`}
        onChange={(n) => setVoiceSettings({ similarity: n })}
      />
      <Slider
        label="Style" hint="How much expression the delivery carries."
        value={v.style} min={0} max={1} step={0.01}
        format={(n) => `${Math.round(n * 100)}%`}
        onChange={(n) => setVoiceSettings({ style: n })}
      />
      <Slider
        label="Speed" hint="Pace of delivery."
        value={v.speed} min={0.7} max={1.2} step={0.01}
        format={(n) => `${n.toFixed(2)}\u00d7`}
        onChange={(n) => setVoiceSettings({ speed: n })}
      />

      <ChoiceRow
        label="Speaker boost"
        hint="Sharpens the voice at a small cost in naturalness."
        value={v.speakerBoost ? 'on' : 'off'}
        options={[{ key: 'off', label: 'Off' }, { key: 'on', label: 'On' }]}
        onChange={(k) => setVoiceSettings({ speakerBoost: k === 'on' })}
      />
    </div>
  );
};
