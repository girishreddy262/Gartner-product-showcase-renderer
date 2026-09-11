import React, { useEffect, useState } from 'react';
import { Icon } from './components/Icon';
import { Splitter } from './components/Splitter';
import { Assistant } from './components/Assistant';
import { SaveBadge } from './components/SaveBadge';
import { VoiceTrack } from './components/VoiceTrack';
import { useAuth, canEdit } from './store/me';
import { MusicPanel } from './components/panels/MusicPanel';
import { Viewer } from './components/Viewer';
import { Timeline } from './components/Timeline';
import { Transcript } from './components/Transcript';
import { Inspector } from './components/Inspector';
import { ShapesPanel } from './components/panels/ShapesPanel';
import { RailPopover } from './components/RailPopover';
import {
  TextPanel, EffectsPanel, TransitionsPanel,
} from './components/panels/SimplePanels';
import { MediaPanel } from './components/panels/MediaPanel';
import { AvatarPanel } from './components/panels/AvatarPanel';
import { AvatarStudio } from './components/AvatarStudio';
import { DropZone } from './components/DropZone';
import { ExportDialog } from './components/ExportDialog';
import { RecordDialog } from './components/RecordDialog';
import { RecordController } from './components/RecordController';
import type { Recorder } from './lib/recorder';
import { ImportToasts } from './components/ImportToasts';
import {
  useStore, undo, redo, removeSelected, setPlaying, seek, getState, setChangeHook, update,
} from './store/project';
import { markDirty, save, load } from './store/persist';
import { projectDurationMs } from './store/validate';
import {
  useUI, setTool, backToTranscript, TOOL_LABELS, type RailTool,
} from './store/ui';

const clampPx = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Tools that open a small popover instead of taking the whole column. */
const POPOVER_TOOLS: RailTool[] = ['shapes'];

const RAIL: { tool: RailTool; icon: string }[] = [
  { tool: 'select', icon: 'pointer' },
  { tool: 'media', icon: 'image' },
  { tool: 'text', icon: 'text' },
  { tool: 'shapes', icon: 'shape' },
  { tool: 'effects', icon: 'fx' },
  { tool: 'transitions', icon: 'transition' },
  { tool: 'audio', icon: 'music' },
  { tool: 'avatar', icon: 'user' },
];

const UsageMeters: React.FC<{ me: NonNullable<ReturnType<typeof useMeSafe>> }> = ({ me }) => {
  const img = me.usage?.images;
  const render = me.usage?.render_seconds;
  const left = (u?: { used: number; allowed: number }) => Math.max(0, Math.round((u?.allowed ?? 0) - (u?.used ?? 0)));
  const low = (u?: { used: number; allowed: number }) => !!u && u.allowed > 0 && u.used / u.allowed > 0.8;
  return (
    <>
      <span className="meter" data-low={low(img)} title="Images left"><b>{left(img)}</b> images</span>
      <span className="meter" data-low={low(render)} title="Export minutes left">
        <b>{Math.floor(left(render) / 60)}</b> min
      </span>
    </>
  );
};

function useMeSafe() {
  const a = useAuth();
  return a.status === 'signed_in' ? a.me : null;
}

export default function App() {
  const project = useStore((s) => s.project);
  const playing = useStore((s) => s.playing);
  const tool = useUI((s) => s.tool);
  const auth = useAuth();
  const me = auth.status === 'signed_in' ? auth.me : null;
  const readOnly = !canEdit(me?.role);
  const fullscreen = useUI((s) => s.fullscreen);

  const [panelW, setPanelW] = useState(268);
  const [popAnchor, setPopAnchor] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [recDialog, setRecDialog] = useState(false);
  // Video above the script, as most transcript editors present it. Kept as a
  // choice because the side-by-side view suits a wide screen better.
  const [stacked, setStacked] = useState(false);
  const [recSource, setRecSource] = useState<'screen' | 'camera' | 'both'>('screen');
  const [rec, setRec] = useState<{ r: Recorder; cam: MediaStream | null } | null>(null);
  const [studio, setStudio] = useState<string | null>(null);
  const [inspW, setInspW] = useState(232);
  const [tlH, setTlH] = useState(240);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const s = getState();
      const next = s.playheadMs + dt;
      const total = projectDurationMs(s.project);
      if (next >= total) { seek(total); setPlaying(false); return; }
      seek(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
      if (e.key === 'Escape') { backToTranscript(); return; }
      if (typing) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(!getState().playing); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Load whatever is at this URL, then autosave from the first change on.
  useEffect(() => {
    const m = location.pathname.match(/^\/e\/([A-Za-z0-9]{6,24})$/);
    if (m) {
      const id = m[1];
      void load(id).then((found) => {
        if (!found) update((p) => { p.id = id; return p; }, { history: false });
        setChangeHook(markDirty);
      });
    } else {
      history.replaceState(null, '', '/e/' + getState().project.id);
      setChangeHook(markDirty);
    }
    // A tab closing mid-edit should still have the local copy written.
    const onHide = () => { if (document.visibilityState === 'hidden') void save(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const panelFor = (t: RailTool) => {
    switch (t) {
      case 'media': return <MediaPanel onRecord={(src) => { setRecSource(src); setRecDialog(true); }} />;
      case 'text': return <TextPanel />;
      case 'effects': return <EffectsPanel />;
      case 'transitions': return <TransitionsPanel />;
      case 'audio': return <MusicPanel />;
      case 'avatar': return <AvatarPanel onOpenStudio={setStudio} />;
      default: return <Transcript />;
    }
  };

  const popOpen = POPOVER_TOOLS.includes(tool);
  const columnTool = popOpen ? 'select' : tool;
  const isHome = columnTool === 'select';

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" aria-label="Back to videos"><Icon n="back" /></button>
        <span className="crumb">Videos</span>
        <span style={{ color: '#41444a' }}>/</span>
        <span>{project.name}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>/e/{project.id}</span>
        <SaveBadge />
        <span className="spacer" />
        {readOnly && <span className="ro-chip">View only</span>}
        <div className="presence" aria-label="People in this workspace">
          {(me?.members || []).slice(0, 3).map((u) => (
            <span key={u.email} className="avatar" title={`${u.name || u.email} · ${u.role}`}>
              {(u.name || u.email).slice(0, 2).toUpperCase()}
            </span>
          ))}
          {(me?.members.length || 0) > 3 && (
            <span className="avatar avatar-more">+{(me?.members.length || 0) - 3}</span>
          )}
        </div>
        <button
          className="icon-btn"
          data-on={stacked}
          aria-pressed={stacked}
          aria-label={stacked ? 'Side by side layout' : 'Video above the transcript'}
          title={stacked ? 'Side by side' : 'Video above transcript'}
          onClick={() => setStacked((v) => !v)}
        >
          <Icon n={stacked ? 'columns' : 'rows'} s={16} />
        </button>
        <button className="icon-btn" aria-label="Version history"><Icon n="history" /></button>
        {me && <UsageMeters me={me} />}
        <button className="btn btn-primary" onClick={() => setExporting(true)}>Export</button>
      </header>

      <div className={stacked ? 'body body-stacked' : 'body'}>
        <nav className="rail" aria-label="Tools">
          {RAIL.map(({ tool: t, icon }) => (
            <button
              key={t}
              className="rail-btn"
              data-on={tool === t}
              data-hint={!isHome && t === 'select'}
              aria-label={t === 'select' ? 'Select, back to transcript' : TOOL_LABELS[t]}
              aria-pressed={tool === t}
              onClick={(e) => {
                setPopAnchor(e.currentTarget.getBoundingClientRect().top);
                setTool(tool === t ? 'select' : t);
              }}
            >
              <Icon n={icon} s={18} />
              <em>{TOOL_LABELS[t]}</em>
            </button>
          ))}
        </nav>

        <div
          className="col panel-col"
          style={stacked ? undefined : { width: panelW, flex: 'none' }}
        >
          <div className="panel-head">
            <span>{isHome ? 'Transcript' : TOOL_LABELS[columnTool]}</span>
            <span className="spacer" />
            {!isHome && (
              <button className="icon-btn" aria-label="Close panel, back to transcript" onClick={backToTranscript}>
                <Icon n="close" s={14} />
              </button>
            )}
          </div>
          {panelFor(columnTool)}
        </div>

        {!stacked && <Splitter onDelta={(d) => setPanelW((w) => clampPx(w + d, 200, 560))} onReset={() => setPanelW(268)} />}

        <div className="col col-viewer" style={stacked ? undefined : { flex: 1 }}>
          <Viewer />
        </div>

        {!stacked && <Splitter onDelta={(d) => setInspW((w) => clampPx(w - d, 190, 420))} onReset={() => setInspW(232)} />}
        <div className="col col-insp" style={stacked ? undefined : { width: inspW, flex: 'none' }}><Inspector /></div>
      </div>

      {!fullscreen && (
        <>
          <Splitter dir="h" onDelta={(d) => setTlH((h) => clampPx(h - d, 150, 480))} onReset={() => setTlH(240)} />
          <div className="tl-row" style={{ height: tlH }}><Timeline onRecord={() => setRecDialog(true)} /></div>
          <VoiceTrack />
        </>
      )}

      {popOpen && (
        <RailPopover anchorY={popAnchor} title={TOOL_LABELS[tool]} onClose={() => setTool('select')}>
          <ShapesPanel onPick={() => setTool('select')} />
        </RailPopover>
      )}

      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
      {recDialog && (
        <RecordDialog
          initialSource={recSource}
          onClose={() => setRecDialog(false)}
          onStart={(r, cam) => { setRecDialog(false); setRec({ r, cam }); }}
        />
      )}
      {studio && <AvatarStudio avatarId={studio} onClose={() => setStudio(null)} />}
      {rec && <RecordController rec={rec.r} camStream={rec.cam} onDone={() => setRec(null)} />}
      <DropZone />
      <ImportToasts />
      <Assistant />
    </div>
  );
}
