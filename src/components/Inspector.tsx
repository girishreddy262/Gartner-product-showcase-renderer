import React from 'react';
import { useStore, patchItem, removeSelected, setAspect } from '../store/project';
import type { Shape, TextOverlay, Callout, Effect, LaneKey, Segment, AspectKey } from '../store/types';
import { ASPECTS } from '../store/types';
import { SHAPE_LABELS } from '../lib/shapes';
import { Slider, NumField, Segmented, Group, Swatch, FillRow, SectionHead, IconGroup, UnitField } from './ui/Controls';
import { Icon } from './Icon';

const pct = (n: number) => `${Math.round(n)}%`;

export const Inspector: React.FC = () => {
  const p = useStore((s) => s.project);
  const sel = useStore((s) => s.selection);

  if (!sel.lane || !sel.id) {
    return (
      <div className="col insp">
        <div className="inspector-head">Project</div>
        <div className="panel-body">
          <Group title="Canvas">
            <div className="grp-sub">Aspect</div>
            <Segmented
              value={p.aspect}
              options={ASPECTS.map((a) => ({ key: a.key, label: a.label }))}
              onChange={(k) => setAspect(k as AspectKey)}
            />
            <Swatch label="Background" value={p.background.value} onChange={() => {}} />
            <div className="row-toggle"><span>Frame rate</span><span className="spacer" /><span className="mono val">30 fps</span></div>
          </Group>
          <p className="hint">Output size is chosen when you export.</p>
        </div>
      </div>
    );
  }

  const lane = sel.lane as LaneKey;
  const arr = p[lane] as unknown as { id: string }[];
  const item = arr.find((x) => x.id === sel.id);
  if (!item) return <div className="col insp"><div className="inspector-head">Nothing selected</div></div>;
  const set = (patch: Record<string, unknown>) => patchItem(lane, sel.id!, patch);
  const t = item as unknown as { startMs: number; durationMs: number };

  let title = 'Item';
  if (lane === 'shapes') title = SHAPE_LABELS[(item as unknown as Shape).kind] || 'Shape';
  else if (lane === 'textOverlays') title = 'Text';
  else if (lane === 'callouts') title = 'Callout';
  else if (lane === 'effects') title = (item as unknown as Effect).type === 'zoom' ? 'Zoom' : 'Spotlight';
  else if (lane === 'camera') title = 'Camera';
  else if (lane === 'segments') title = 'Clip';

  return (
    <div className="col insp">
      <div className="inspector-head">
        {title}<span className="spacer" />
        <button className="icon-btn" aria-label="Delete" onClick={removeSelected}><Icon n="trash" s={14} /></button>
      </div>

      <div className="panel-body">
        {(lane === 'segments' || lane === 'camera') && (() => {
          const sg = item as unknown as Segment;
          const media = p.media.find((m) => m.id === sg.videoId);
          return (
            <>
              <Group title="Source">
                <div className="row-toggle"><span>File</span><span className="spacer" /><span className="val ellip">{media?.name || 'missing'}</span></div>
                <Slider label="Speed" value={(sg.speed ?? 1) * 100} min={25} max={400} step={5} format={pct} onChange={(n) => set({ speed: n / 100 })} />
                <Segmented
                  label="Audio" small
                  value={sg.muteSourceAudio === false ? 'on' : 'muted'}
                  options={[{ key: 'muted', label: 'Muted' }, { key: 'on', label: 'On' }]}
                  onChange={(k) => set({ muteSourceAudio: k === 'muted' })}
                />
              </Group>

              <Group title="Framing">
                <Slider label="Scale" value={(sg.scale ?? 1) * 100} min={50} max={400} step={1} format={pct} onChange={(n) => set({ scale: n / 100 })} />
                <div className="pair">
                  <NumField label="Position X" value={sg.x ?? 0} onChange={(n) => set({ x: n })} />
                  <NumField label="Position Y" value={sg.y ?? 0} onChange={(n) => set({ y: n })} />
                </div>
              </Group>

              <Group title="Crop">
                <Slider label="Top" value={(sg.cropTop ?? 0) * 100} min={0} max={45} format={pct} onChange={(n) => set({ cropTop: n / 100 })} />
                <Slider label="Bottom" value={(sg.cropBottom ?? 0) * 100} min={0} max={45} format={pct} onChange={(n) => set({ cropBottom: n / 100 })} />
                <Slider label="Left" value={(sg.cropLeft ?? 0) * 100} min={0} max={45} format={pct} onChange={(n) => set({ cropLeft: n / 100 })} />
                <Slider label="Right" value={(sg.cropRight ?? 0) * 100} min={0} max={45} format={pct} onChange={(n) => set({ cropRight: n / 100 })} />
              </Group>

              {lane === 'camera' && (
                <Group title="Bubble">
                  <Slider label="Size" value={sg.size ?? 320} min={120} max={900} onChange={(n) => set({ size: n })} />
                  <Segmented
                    label="Shape" small value={sg.shape || 'circle'}
                    options={[{ key: 'circle', label: 'Circle' }, { key: 'rounded', label: 'Rounded' }, { key: 'square', label: 'Square' }]}
                    onChange={(k) => set({ shape: k })}
                  />
                </Group>
              )}

              <Group title="Timing">
                <div className="pair">
                  <NumField label="Trim from" value={sg.sourceStartMs || 0} step={100} onChange={(n) => set({ sourceStartMs: n })} />
                  <NumField label="Length" value={sg.durationMs} step={100} onChange={(n) => set({ durationMs: n })} />
                </div>
              </Group>
            </>
          );
        })()}

        {lane === 'shapes' && (() => {
          const s = item as unknown as Shape;
          return (
            <>
              <section className="grp">
                <SectionHead title="Fill" />
                <FillRow
                  value={s.fill} opacity={s.opacity}
                  onColor={(v) => set({ fill: v })} onOpacity={(n) => set({ opacity: n })}
                />
              </section>
              <section className="grp">
                <SectionHead title="Stroke" muted={!s.strokeWidth} />
                <FillRow value={s.stroke} opacity={1} onColor={(v) => set({ stroke: v })} onOpacity={() => {}} />
                <div className="pair" style={{ marginTop: 8 }}>
                  <UnitField label="Width" value={s.strokeWidth} onChange={(v) => set({ strokeWidth: Number(v) || 0 })} />
                </div>
              </section>
              <Group title="Shape">
                {s.kind === 'roundedRect' && <Slider label="Corner radius" value={s.radius} min={0} max={200} onChange={(n) => set({ radius: n })} />}
                {(s.kind === 'polygon' || s.kind === 'star') && <Slider label="Sides" value={s.sides} min={3} max={12} onChange={(n) => set({ sides: n })} />}
                {s.kind === 'star' && <Slider label="Inner radius" value={s.innerRatio * 100} min={10} max={90} format={pct} onChange={(n) => set({ innerRatio: n / 100 })} />}
                {s.kind !== 'roundedRect' && s.kind !== 'polygon' && s.kind !== 'star' && <p className="hint">No extra shape options.</p>}
              </Group>
              <Group title="Transform">
                <Slider label="Rotation" value={s.rotation} min={-180} max={180} format={(n) => `${Math.round(n)}°`} onChange={(n) => set({ rotation: n })} />
                <div className="pair">
                  <NumField label="W" value={s.width} onChange={(n) => set({ width: n })} />
                  <NumField label="H" value={s.height} onChange={(n) => set({ height: n })} />
                </div>
                <div className="pair">
                  <NumField label="X" value={s.x} onChange={(n) => set({ x: n })} />
                  <NumField label="Y" value={s.y} onChange={(n) => set({ y: n })} />
                </div>
              </Group>
            </>
          );
        })()}

        {lane === 'textOverlays' && (() => {
          const tx = item as unknown as TextOverlay;
          return (
            <>
              <Group title="Content">
                <label className="text-input"><span>Text</span>
                  <input value={tx.text} onChange={(e) => set({ text: e.target.value })} aria-label="Text content" />
                </label>
              </Group>
              <section className="grp">
                <SectionHead title="Typography" />
                <select className="ff" value={tx.fontFamily || 'Inter'} onChange={(e) => set({ fontFamily: e.target.value })} aria-label="Font">
                  {['Inter', 'Satoshi', 'Georgia', 'Helvetica', 'Courier New'].map((f) => <option key={f}>{f}</option>)}
                </select>
                <div className="pair" style={{ marginTop: 8 }}>
                  <select className="ff" value={tx.fontWeight || '600'} onChange={(e) => set({ fontWeight: e.target.value })} aria-label="Weight">
                    {[['300','Light'],['400','Regular'],['600','Semibold'],['700','Bold'],['900','Black']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <UnitField label="" value={tx.fontSize} onChange={(v) => set({ fontSize: Number(v) || 16 })} />
                </div>
                <div className="pair" style={{ marginTop: 8 }}>
                  <UnitField label="Line height" value={tx.lineHeight ?? 1.2} step={0.05} onChange={(v) => set({ lineHeight: Number(v) || 1.2 })} />
                  <UnitField label="Letter spacing" value={tx.letterSpacing ?? 0} unit="%" onChange={(v) => set({ letterSpacing: Number(v) || 0 })} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <IconGroup
                    label="Alignment" value={tx.align || 'left'}
                    onChange={(k) => set({ align: k })}
                    options={[
                      { key: 'left', label: 'Align left', path: 'M4 6h16M4 12h10M4 18h13' },
                      { key: 'center', label: 'Align centre', path: 'M4 6h16M7 12h10M6 18h12' },
                      { key: 'right', label: 'Align right', path: 'M4 6h16M10 12h10M7 18h13' },
                    ]}
                  />
                </div>
              </section>
              <section className="grp">
                <SectionHead title="Fill" />
                <FillRow value={tx.color} opacity={tx.opacity ?? 1}
                  onColor={(v) => set({ color: v })} onOpacity={(n) => set({ opacity: n })} />
              </section>
              <Group title="Transform">
                <div className="pair">
                  <NumField label="X" value={tx.x} onChange={(n) => set({ x: n })} />
                  <NumField label="Y" value={tx.y} onChange={(n) => set({ y: n })} />
                </div>
              </Group>
            </>
          );
        })()}

        {lane === 'callouts' && (
          <Group title="Content">
            <label className="text-input"><span>Text</span>
              <input value={(item as unknown as Callout).text} onChange={(e) => set({ text: e.target.value })} aria-label="Callout text" />
            </label>
          </Group>
        )}

        {lane === 'effects' && (item as unknown as Effect).type === 'zoom' && (
          <Group title="Zoom">
            <Slider label="Scale" value={((item as unknown as Effect).scale || 1) * 100} min={100} max={400} format={pct} onChange={(n) => set({ scale: n / 100 })} />
          </Group>
        )}

        {lane !== 'segments' && lane !== 'camera' && (
          <Group title="Timing">
            <div className="pair">
              <NumField label="Start" value={t.startMs} step={100} onChange={(n) => set({ startMs: n })} />
              <NumField label="Length" value={t.durationMs} step={100} onChange={(n) => set({ durationMs: n })} />
            </div>
          </Group>
        )}
      </div>
    </div>
  );
};
