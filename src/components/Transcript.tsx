import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { VoicePickerDialog } from './VoicePickerDialog';
import { TranscriptSearch } from './TranscriptSearch';
import { clearAuto } from '../store/autoScene';
import { pointsFor, addPin, removePin } from '../store/sync';
import {
  useStore, setBlockText, markWords, removeFillers, fillerCount, restoreAll, insertWords,
  gapCount, gapSavingMs, trimGaps, trimmedGapCount, restoreGaps,
  setPauseAfter, nudgePause, splitVoice, mergeVoice, setSectionVoice,
  convertToGenerated, revertToRecording, replaceSelectionWithVoice, setBlockVoiceOverride, seek,
  setPlaying, getState, update,
} from '../store/project';
import { getUI, rememberTranscript } from '../store/ui';
import type { Block, Section, Word } from '../store/types';
import { fmt } from '../lib/time';
import { checkServices } from '../lib/api';
import { VoicePanel } from './VoicePanel';
import {
  transcribeProject, generateAll, generateBlock, onVoice, getVoiceState, loadVoices, getVoices, setProjectVoice,
  cleanText, autoScenesOn, setAutoScenes,
  adoptDefaultVoice,
} from '../store/voice';
import { generateAvatarClip, onAvatarJobs, getAvatarJobs, GESTURE_CHOICES, type JobState } from '../store/avatarClips';

/** Blocks grouped under the sections the assistant derived from the content. */
function group(blocks: Block[], sections: Section[]) {
  if (!sections.length) return [{ section: null as Section | null, blocks, from: 0 }];
  return sections.map((s, i) => {
    const to = i + 1 < sections.length ? sections[i + 1].fromBlock : blocks.length;
    return { section: s, blocks: blocks.slice(s.fromBlock, to), from: s.fromBlock };
  });
}

/** "Sarah - Mature, Reassuring" reads as "Sarah" on a chip. */
const shortVoice = (n?: string) => (n || 'Voice').split(/\s+[-\u2013\u2014]\s+/)[0].trim() || 'Voice';

const BlockView: React.FC<{ b: Block; startMs: number; index: number }> = ({ b, startMs, index }) => {
  const [sel, setSel] = useState<{ from: number; to: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; i: number } | null>(null);
  const [pick, setPick] = useState<{ i: number; creating: boolean } | null>(null);
  const [voicePick, setVoicePick] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const playhead = useStore((s) => s.playheadMs);
  const allProject = useStore((s) => s.project);
  const projectVoiceName = allProject.voiceSettings.voiceName || 'Project voice';

  // Which word is being spoken right now, relative to this block.
  const live = (() => {
    if (!b.words?.length) return -1;
    const t = playhead - startMs;
    if (t < 0 || t > b.durationMs) return -1;
    return b.words.findIndex((w) => t >= w.startMs && t < w.endMs);
  })();

  // Keep the spoken word in view without yanking the panel around.
  useEffect(() => {
    if (live >= 0) liveRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [live]);

  // Delete removes whatever is selected in this block.
  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        // App also listens for Delete to remove timeline items. With a word
        // selection active, this is the only handler that should run.
        e.stopPropagation();
        markWords(b.id, sel.from, sel.to, true);
        setSel(null);
      }
      if (e.key === 'Escape') setSel(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sel, b.id]);
  const onPickVoice = (_id: string, i: number, creating = false) => setPick({ i, creating });

  // Having words is what makes word editing possible. Keying this off source
  // meant that replacing a recording with a voice silently took away deleting,
  // pauses and sync points, which is exactly when people still want them.
  if (b.words?.length) {
    const words = b.words;
    const struck = words.filter((w) => w.del).length;
    const secAt = (i: number) => (b.voiceSections || []).find((s) => s.w === i);
    const pins = pointsFor(allProject, b.id);

    return (
      <div className="tb">
        <div className="tb-head">
          <span className="clip-n">{index + 1}</span>
          <span className="clip-kind">{b.overRecording ? 'Voiceover' : 'Recording'}</span>
          <button
            className="clip-voice"
            title="Change the voice"
            onClick={() => setPick({ i: 0, creating: false })}
          >
            <Icon n="mic" s={11} />
            {shortVoice(b.voiceOverride ? b.voiceName : projectVoiceName)}
          </button>
          <span className="spacer" />
          <span className="mono tb-time">{fmt(startMs)}</span>
        </div>

        <p className="tb-text" onContextMenu={(e) => e.preventDefault()}>
          {words.map((w, i) => {
            const sec = secAt(i);
            const pin = pins.find((s) => s.wordIndex === i);
            const on = sel && i >= Math.min(sel.from, sel.to) && i <= Math.max(sel.from, sel.to);
            return (
              <React.Fragment key={i}>
                {sec && (
                  <span className="secbar" contentEditable={false}>
                    <span className="ln" />
                    <button
                      className="secvoice"
                      title={`${sec.voiceName} · click to change this section's voice`}
                      onClick={() => onPickVoice(b.id, i)}
                    >
                      <Icon n="mic" s={11} />{sec.voiceName.split(' - ')[0].split(',')[0]}
                      <span
                        className="x"
                        title="Merge with the previous voice"
                        onClick={(e) => { e.stopPropagation(); mergeVoice(b.id, i); }}
                      >×</span>
                    </button>
                  </span>
                )}
                {pin && (
                  <button
                    className={`syncchip${pin.manual ? ' manual' : ''}`}
                    contentEditable={false}
                    title={`This word lands at ${fmt(pin.sourceMs)} in the footage. Click to remove.`}
                    onClick={(e) => { e.stopPropagation(); removePin(pin.id); }}
                  >
                    <Icon n="pin" s={10} /> Sync Point
                  </button>
                )}
                <span
                  ref={live === i ? liveRef : undefined}
                  className={`w${w.del ? ' w-del' : ''}${on ? ' w-on' : ''}${live === i ? ' w-live' : ''}${w.added ? ' w-add' : ''}`}
                  title={w.del ? 'Removed. Double-click or right-click to restore.' : undefined}
                  onPointerDown={(e) => { if (e.button === 0) setSel({ from: i, to: i }); }}
                  onPointerEnter={(e) => { if (e.buttons === 1 && sel) setSel({ ...sel, to: i }); }}
                  // A single click moves the video to that word, which is the
                  // whole point of editing from the script.
                  onClick={() => seek(startMs + w.startMs)}
                  onDoubleClick={(e) => { e.preventDefault(); markWords(b.id, i, i, !w.del); setSel(null); }}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, i }); }}
                >{w.text} </span>
                {!!w.pauseAfterMs && (
                  <span className="pausechip" contentEditable={false} title="Pause in the voiceover">
                    <Icon n="pause" s={10} />{(w.pauseAfterMs / 1000).toFixed(1)}s
                    <button title="Shorter" onClick={() => nudgePause(b.id, i, -500)}>−</button>
                    <button title="Longer" onClick={() => nudgePause(b.id, i, 500)}>+</button>
                    <button title="Remove" onClick={() => setPauseAfter(b.id, i, 0)}>×</button>
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </p>

        {sel && (
          <div className="selbar" role="toolbar" aria-label="Selected words">
            <span className="selbar-n">
              {Math.abs(sel.to - sel.from) + 1} word{Math.abs(sel.to - sel.from) ? 's' : ''}
            </span>
            <span className="spacer" />
            <button
              className="act act-danger"
              title="Delete these words and the video where they were said"
              onClick={() => { markWords(b.id, sel.from, sel.to, true); setSel(null); }}
            >
              <Icon n="eraser" s={12} /> Delete
            </button>
            <button className="act" onClick={() => setAdding(Math.max(sel.from, sel.to))}>
              <Icon n="plus" s={12} /> Add text
            </button>
            <button
              className="btn btn-primary btn-sm"
              title="Speak just these words in a different voice"
              onClick={() => setVoicePick(true)}
            >
              <Icon n="mic" s={12} /> Different voice
            </button>
          </div>
        )}

        {adding != null && (
          <div className="addbar">
            <input
              className="inp" autoFocus placeholder="Words to add here"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { insertWords(b.id, adding, e.currentTarget.value); setAdding(null); setSel(null); }
                if (e.key === 'Escape') setAdding(null);
              }}
            />
            <button className="act" onClick={() => setAdding(null)}>Cancel</button>
          </div>
        )}

        {voicePick && sel && (
          <VoicePickerDialog
            title="Voice for the selected words"
            onPick={(v) => {
              const id = replaceSelectionWithVoice(b.id, sel.from, sel.to, v.voiceId, v.name);
              setVoicePick(false); setSel(null);
              if (id) void generateBlock(id);
            }}
            onClose={() => setVoicePick(false)}
          />
        )}

        <AvatarRow block={b} />

        <div className="tb-acts tb-acts-hover">
          {fillerCount(b) > 0 && (
            <button className="act" onClick={() => removeFillers(b.id)}>
              Remove {fillerCount(b)} filler{fillerCount(b) === 1 ? '' : 's'}
            </button>
          )}
          {struck > 0 && (
            <button className="act" onClick={() => restoreAll(b.id)}>
              Restore {struck} word{struck === 1 ? '' : 's'}
            </button>
          )}
          {gapCount(b) > 0 && (
            <button
              className="act"
              title="Shorten the long silences, keeping a quarter-second beat"
              onClick={() => trimGaps(b.id)}
            >
              Tighten {gapCount(b)} pause{gapCount(b) === 1 ? '' : 's'}
              <em className="act-note"> saves {(gapSavingMs(b) / 1000).toFixed(1)}s</em>
            </button>
          )}
          {trimmedGapCount(b) > 0 && (
            <button className="act" onClick={() => restoreGaps(b.id)}>
              Restore pauses
            </button>
          )}
          {b.overRecording
            ? <button className="act" onClick={() => revertToRecording(b.id)}>Use original take</button>
            : <button className="act" onClick={() => convertToGenerated(b.id, 'sarah', 'Sarah')}>Replace with voice</button>}
        </div>


        {pick && (
          <VoicePickerDialog
            offerAll={!pick.creating}
            title={pick.creating ? 'Voice for this new section' : 'Change this section\u2019s voice'}
            onPick={(v, applyAll) => {
              if (pick.creating) splitVoice(b.id, pick.i, v.voiceId, v.name);
              else if (applyAll) setProjectVoice(v.voiceId, v.name);
              else setSectionVoice(b.id, pick.i, v.voiceId, v.name);
              setPick(null);
            }}
            onClose={() => setPick(null)}
          />
        )}

        {menu && (
          <WordMenu
            x={menu.x} y={menu.y}
            word={words[menu.i]}
            hasSection={!!secAt(menu.i) && menu.i > 0}
            hasPin={pins.some((s) => s.wordIndex === menu.i)}
            onClose={() => setMenu(null)}
            onAction={(a) => {
              const i = menu.i;
              const lo = sel ? Math.min(sel.from, sel.to) : i;
              const hi = sel ? Math.max(sel.from, sel.to) : i;
              const inSel = sel && i >= lo && i <= hi;
              if (a === 'del') markWords(b.id, inSel ? lo : i, inSel ? hi : i, true);
              if (a === 'undel') markWords(b.id, inSel ? lo : i, inSel ? hi : i, false);
              if (a === 'pause') setPauseAfter(b.id, i, 1000);
              if (a === 'pdel') setPauseAfter(b.id, i, 0);
              if (a === 'slow') nudgePause(b.id, i, (words[i].pauseAfterMs ? 700 : 1500));
              if (a === 'fast') setPauseAfter(b.id, i, 0);
              if (a === 'pin') addPin(b.id, i);
              if (a === 'unpin') { const s = pins.find((x) => x.wordIndex === i); if (s) removePin(s.id); }
              if (a === 'secsplit') onPickVoice(b.id, i, true);
              if (a === 'secmerge') mergeVoice(b.id, i);
              setMenu(null); setSel(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="tb">
      <div className="tb-head">
        <span className="clip-n">{index + 1}</span>
        <span className="clip-kind">{b.overRecording ? 'Voiceover' : 'Script'}</span>
        <button className="clip-voice" title="Change the voice" onClick={() => setPick({ i: 0, creating: false })}>
          <Icon n="mic" s={11} />
          {shortVoice(b.voiceOverride ? b.voiceName : projectVoiceName)}
        </button>
        <span className="spacer" />
        {b.audioUrl && !b.dirty && <span className="tb-ok" title="Voice generated" />}
        {b.dirty && <span className="tb-edited">Edited</span>}
      </div>
      <textarea
        data-block={b.id}
        className="tb-text"
        value={b.text}
        rows={Math.max(2, Math.ceil(b.text.length / 44))}
        onChange={(e) => setBlockText(b.id, e.target.value)}
        onFocus={(e) => rememberTranscript({ focusBlockId: b.id, caret: e.currentTarget.selectionStart })}
        onBlur={(e) => rememberTranscript({ caret: e.currentTarget.selectionStart })}
      />
      <AvatarRow block={b} />

      {pick && (
        <VoicePickerDialog
          offerAll
          title="Change the voice"
          currentId={b.voiceId}
          onPick={(v, applyAll) => {
            if (applyAll) setProjectVoice(v.voiceId, v.name);
            else setBlockVoiceOverride(b.id, v.voiceId, v.name);
            setPick(null);
          }}
          onClose={() => setPick(null)}
        />
      )}
    </div>
  );
};

/**
 * One voice for the whole script. Choosing per paragraph is a chore on a forty
 * block transcript, and almost nobody wants a different narrator per sentence.
 */


/** The right-click menu, matching the previous editor's actions. */
const WordMenu: React.FC<{
  x: number; y: number; word: Word; hasSection: boolean; hasPin: boolean;
  onClose: () => void; onAction: (a: string) => void;
}> = ({ x, y, word, hasSection, hasPin, onClose, onAction }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // Listen on the next tick so the click that opened it does not close it.
    const t = setTimeout(() => {
      document.addEventListener('mousedown', away, true);
      document.addEventListener('keydown', key, true);
    });
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', away, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [onClose]);

  // Keep it on screen.
  const style: React.CSSProperties = {
    left: Math.max(8, Math.min(x, window.innerWidth - 236)),
    top: Math.max(8, Math.min(y, window.innerHeight - 268)),
  };

  const item = (a: string, icon: string, label: string) => (
    <button onClick={() => onAction(a)}><Icon n={icon} s={13} />{label}</button>
  );

  return (
    <div className="ctxmenu" ref={ref} style={style} role="menu">
      {word.del
        ? item('undel', 'undo', 'Restore this word')
        : item('del', 'eraser', 'Remove this word')}
      <div className="sep" />
      {hasPin ? item('unpin', 'pin', 'Remove sync point') : item('pin', 'pin', 'Add sync point here')}
      <div className="sep" />
      {word.pauseAfterMs
        ? item('pdel', 'stop', 'Remove pause')
        : item('pause', 'pause', 'Add pause')}
      {item('slow', 'prev', 'Slow down this part')}
      {item('fast', 'next', 'Speed up this part')}
      <div className="sep" />
      {hasSection
        ? item('secmerge', 'merge', 'Merge with the previous voice')
        : item('secsplit', 'userplus', 'Start a new voice here')}
    </div>
  );
};

function useVoiceState() {
  const [v, setV] = useState(getVoiceState());
  useEffect(() => onVoice(() => setV(getVoiceState())), []);
  return v;
}

const VoiceBar: React.FC = () => {
  const settings = useStore((s) => s.project.voiceSettings);
  const [voices, setVoices] = useState(getVoices());
  const [open, setOpen] = useState(false);
  useEffect(() => { void loadVoices().then(setVoices); }, []);

  const current = settings.voiceName
    || voices.find((v) => v.voiceId === settings.voiceId)?.name
    || voices[0]?.name
    || 'Default voice';

  const allBlocks = useStore((s) => s.project.blocks);
  const pending = allBlocks.filter((b) => b.source === 'generated' && (b.dirty || !b.audioUrl)).length;
  const total = allBlocks.filter((b) => b.source === 'generated').length;
  const done = total - pending;
  const vs = useVoiceState();

  return (
    <div className="vbar">
      <button className="vbar-pick" onClick={() => setOpen(true)} aria-label="Choose the voice for this script">
        <span className="vbar-dot" />
        <span className="vbar-name">{current}</span>
        <span className="act">Change</span>
      </button>
      {open && (
        <VoicePickerDialog
          title="Voice for this script"
          currentId={settings.voiceId}
          offerAll
          onPick={(v) => { setProjectVoice(v.voiceId, v.name); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};

/** When something fails, show WHICH service is unreachable rather than leaving
 *  the user to guess between four possible backends. */
const ServiceCheck: React.FC = () => {
  const [rows, setRows] = useState<{ name: string; ok: boolean; detail: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="svc">
      {!rows && (
        <button className="act" disabled={busy} onClick={async () => {
          setBusy(true);
          setRows(await checkServices());
          setBusy(false);
        }}>{busy ? 'Checking' : 'Check services'}</button>
      )}
      {rows?.map((r) => (
        <div className="svc-row" key={r.name}>
          <span className="svc-dot" data-ok={r.ok} />
          <span className="svc-name">{r.name}</span>
          <span className="spacer" />
          <span className="svc-detail">{r.ok ? 'reachable' : r.detail}</span>
        </div>
      ))}
    </div>
  );
};

/** Per block: an escape hatch for the odd paragraph. The whole script is
 *  delivered from the Avatar panel; the gesture comes from the text. */
const AvatarRow: React.FC<{ block: Block }> = ({ block }) => {
  // Selectors must return a STABLE reference. Filtering inside the selector
  // builds a new array every render, which fails the equality check and loops
  // forever (React error #185). Select the array, filter after.
  const all = useStore((s) => s.project.avatars);
  const avatars = all.filter((a) => a.status === 'ready');
  const [jobs, setJobs] = useState<JobState[]>(getAvatarJobs());
  useEffect(() => onAvatarJobs(setJobs), []);
  const job = jobs.find((j) => j.blockId === block.id);
  if (!avatars.length) return null;

  return (
    <div className="av-row">
      {job && !job.error && (
        <span className="hint">
          {job.queue ? `Queued, ${job.queue} ahead` : `Rendering ${Math.round(job.pct * 100)}%`}
        </span>
      )}
      {job?.error && <span className="hint" style={{ color: 'var(--danger)' }}>{job.error}</span>}
      {/* A failed job must not swallow the button, or there is no way to try
          again after fixing whatever it complained about. */}
      {(!job || job.error) && (
        <>
          <button
            className="act" aria-label="Deliver this block with an avatar"
            onClick={() => generateAvatarClip(block.id, avatars[0].id)}
          >
            Use {avatars[0].name}
          </button>
        </>
      )}
    </div>
  );
};



/**
 * Tidies the script with the language model. Shows a preview first: a rewrite
 * changes wording, so the original word timings no longer apply and the
 * affected paragraphs must be spoken again.
 */
const RewriteButton: React.FC = () => {
  const blocks = useStore((s) => s.project.blocks);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ before: string; after: string } | null>(null);
  const [note, setNote] = useState('');
  const [available, setAvailable] = useState(true);

  // Ask once when the panel loads. If the service cannot rewrite, the button
  // is never shown at all, so it can never disappear mid-click.
  useEffect(() => {
    let alive = true;
    void cleanText('probe')
      .then((r) => { if (alive && !r.configured) setAvailable(false); })
      .catch(() => { if (alive) setAvailable(false); });
    return () => { alive = false; };
  }, []);

  const run = async () => {
    const source = blocks.map((b) => b.text).join('\n\n').trim();
    if (!source) return;
    setBusy(true); setNote('');
    try {
      const r = await cleanText(source);
      if (!r.configured) {
        // Check once, quietly, rather than making the button vanish under the
        // cursor: a control that disappears when clicked reads as a bug.
        setNote('Rewriting is not switched on for this workspace.');
      } else if (!r.text || r.text.trim() === source) {
        setNote('Nothing to tidy in this script.');
      } else {
        setPreview({ before: source, after: r.text.trim() });
      }
    } catch (e) {
      setNote(String((e as Error).message));
    }
    setBusy(false);
  };

  const apply = () => {
    if (!preview) return;
    const parts = preview.after.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    update((p) => {
      // Map paragraph for paragraph where the counts line up; otherwise put the
      // whole rewrite in the first block rather than scrambling the mapping.
      if (parts.length === p.blocks.length) {
        p.blocks.forEach((b, i) => { b.text = parts[i]; b.dirty = true; });
      } else if (p.blocks[0]) {
        p.blocks[0].text = parts.join('\n\n');
        p.blocks[0].dirty = true;
      }
      return p;
    });
    setPreview(null);
  };

  if (!available) return null;

  return (
    <>
      <button className="act" disabled={busy} onClick={run} title="Tidy the script with AI">
        {busy ? 'Rewriting\u2026' : 'AI Rewrite'}
      </button>
      {note && <span className="rw-note">{note}</span>}

      {preview && (
        <div className="dlg-scrim" onMouseDown={() => setPreview(null)}>
          <div className="dlg dlg-640" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Review the rewrite">
            <div className="dlg-head">
              <h2>Review the rewrite</h2>
              <button className="icon-btn" onClick={() => setPreview(null)} aria-label="Close"><Icon n="x" s={15} /></button>
            </div>
            <div className="rw-cols">
              <div><p className="rw-lab">Now</p><p className="rw-txt">{preview.before}</p></div>
              <div><p className="rw-lab">After</p><p className="rw-txt rw-new">{preview.after}</p></div>
            </div>
            <p className="dlg-foot">
              <span className="hint">Rewritten paragraphs need generating again.</span>
              <span className="spacer" />
              <button className="act" onClick={() => setPreview(null)}>Keep as it is</button>
              <button className="btn btn-primary" onClick={apply}>Use the rewrite</button>
            </p>
          </div>
        </div>
      )}
    </>
  );
};


/** Whether generating speech also lays down chapters, zooms and spotlights. */
const AutoScenesToggle: React.FC = () => {
  const [on, setOn] = useState(autoScenesOn());
  const n = useStore((s) => s.project.effects.filter((e) => e.id.startsWith('auto:')).length
    + s.project.textOverlays.filter((o) => o.id.startsWith('auto:')).length);
  return (
    <button
      className="act"
      data-on={on}
      aria-pressed={on}
      title="Add chapter titles, zooms and spotlights when speech is generated"
      onClick={() => { const v = !on; setOn(v); setAutoScenes(v); if (!v) clearAuto(); }}
    >
      <Icon n="sparkle" s={12} /> Auto scenes{on && n ? ` (${n})` : ''}
    </button>
  );
};


/** The things that do not need a permanent button: transcribe again, auto
 *  scenes, and anything else that arrives later. */
const FootMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const voice = useVoiceState();
  const [auto, setAuto] = useState(autoScenesOn());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const t = setTimeout(() => document.addEventListener('mousedown', away, true));
    return () => { clearTimeout(t); document.removeEventListener('mousedown', away, true); };
  }, [open]);

  return (
    <div className="footmenu" ref={ref}>
      <button className="icon-btn" aria-label="More" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon n="more" s={15} />
      </button>
      {open && (
        <div className="ctxmenu footmenu-pop" role="menu">
          <button disabled={!!voice.busy} onClick={() => { transcribeProject(); setOpen(false); }}>
            <Icon n="undo" s={13} />Transcribe again
          </button>
          <button onClick={() => { const v = !auto; setAuto(v); setAutoScenes(v); if (!v) clearAuto(); setOpen(false); }}>
            <Icon n="sparkle" s={13} />{auto ? 'Turn off auto scenes' : 'Turn on auto scenes'}
          </button>
        </div>
      )}
    </div>
  );
};


/** Voice settings, anchored to its button. Closes on Escape or a click away,
 *  like any other popover in the app. */
const VoiceSettingsPop: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<number>();

  // CSS cannot know how much room is left above the footer, so measure it.
  // Guessing with vh clipped the top rows off the screen entirely.
  useEffect(() => {
    const fit = () => {
      const el = ref.current;
      const panel = el?.closest('.panel-body') as HTMLElement | null;
      const foot = el?.closest('.tb-foot') as HTMLElement | null;
      if (!el || !panel || !foot) return;
      const room = foot.getBoundingClientRect().top - panel.getBoundingClientRect().top - 16;
      setMaxH(Math.max(160, room));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  useEffect(() => {
    const away = (e: MouseEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node) && !(e.target as HTMLElement).closest('.vset-anchor')) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', away, true);
      document.addEventListener('keydown', key, true);
    });
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', away, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [onClose]);

  return (
    <div className="vset-pop" ref={ref} style={{ maxHeight: maxH }} role="dialog" aria-label="Voice settings">
      <VoicePanel embedded />
    </div>
  );
};

export const Transcript: React.FC = () => {
  const [search, setSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Only Cmd/Ctrl+F is added here. Space, Delete and Cmd+Z are owned by App;
  // adding them again made Space fire twice and cancel itself out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearch(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const blocks = useStore((s) => s.project.blocks);
  const sections = useStore((s) => s.project.sections);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [voice, setVoice] = useState(getVoiceState());
  useEffect(() => onVoice(setVoice), []);
  useEffect(() => { void loadVoices().then(adoptDefaultVoice); }, []);
  const pending = blocks.filter((b) => b.source !== 'recorded' && (b.dirty || !b.audioUrl)).length;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const m = getUI().transcript;
    const raf = requestAnimationFrame(() => {
      el.scrollTop = m.scrollTop;
      if (m.focusBlockId) {
        const ta = el.querySelector<HTMLTextAreaElement>(`[data-block="${m.focusBlockId}"]`);
        if (ta) { ta.focus({ preventScroll: true }); if (m.caret != null) ta.setSelectionRange(m.caret, m.caret); }
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!blocks.length) {
    return (
      <div className="panel-body" ref={scrollRef}>
        <p className="hint">Record or import a video, then transcribe it. The script appears here in paragraphs with sections named from what the video covers.</p>
        <button className="import-btn" style={{ marginTop: 16 }} onClick={() => transcribeProject()} disabled={!!voice.busy}>
          {voice.busy || 'Transcribe'}
        </button>
        {voice.error && (
          <>
            <p className="hint" style={{ color: 'var(--danger)' }}>{voice.error}</p>
            <ServiceCheck />
          </>
        )}
      </div>
    );
  }

  let acc = 0;
  const starts = blocks.map((b) => { const s = acc; acc += b.durationMs; return s; });

  return (
    <div className="panel-body" ref={scrollRef} onScroll={(e) => rememberTranscript({ scrollTop: e.currentTarget.scrollTop })}>
      <div className="tr-tools">
        <button className="act" onClick={() => setSearch((v) => !v)} aria-label="Find and replace">
          <Icon n="search" s={13} /> Find
        </button>
      </div>
      {search && <TranscriptSearch onClose={() => setSearch(false)} />}

      {group(blocks, sections).map((g, gi) => {
        const first = starts[g.from] ?? 0;
        const lastIdx = g.from + g.blocks.length - 1;
        const last = (starts[lastIdx] ?? 0) + (blocks[lastIdx]?.durationMs ?? 0);
        return (
          <section key={g.section?.id || gi} className="sect">
            {g.section && (
              <header className="sect-head" onClick={() => seek(first)}>
                <span>{g.section.title}</span>
                <span className="mono sect-time">{fmt(first)} – {fmt(last)}</span>
              </header>
            )}
            <div className="sect-body">
              {g.blocks.map((b, i) => <BlockView key={b.id} b={b} startMs={starts[g.from + i] ?? 0} index={g.from + i} />)}
            </div>
          </section>
        );
      })}


      <div className="tb-foot">
        {showSettings && <VoiceSettingsPop onClose={() => setShowSettings(false)} />}
        {voice.error && (
          <>
            <p className="hint" style={{ color: 'var(--danger)' }}>{voice.error}</p>
            <ServiceCheck />
          </>
        )}
        {voice.busy && voice.total > 0 && (
          <div className="gen-bar"><i style={{ width: `${Math.round((voice.done / voice.total) * 100)}%` }} /></div>
        )}
        <div className="tb-foot-row">
          <FootMenu />
          <RewriteButton />
          <div className="vset-anchor">
            <button
              className="icon-btn"
              data-on={showSettings}
              aria-label="Voice settings"
              aria-expanded={showSettings}
              title="Voice settings"
              onClick={() => setShowSettings((v) => !v)}
            >
              <Icon n="sliders" s={15} />
            </button>
          </div>
        </div>

        <div className="tb-foot-main">
          <button
            className="btn btn-primary btn-generate"
            disabled={!!voice.busy}
            onClick={() => generateAll(pending > 0)}
          >
            {/* The bar shows how far along it is; a counter told nobody
                anything useful. */}
            {voice.busy && voice.total > 0 && (
              <span className="btn-fill" style={{ width: `${Math.round((voice.done / voice.total) * 100)}%` }} />
            )}
            <span className="btn-label">
              {voice.busy
                ? voice.busy
                : pending > 0
                  ? `Generate speech${pending > 1 ? ` (${pending})` : ''}`
                  : 'Regenerate speech'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
