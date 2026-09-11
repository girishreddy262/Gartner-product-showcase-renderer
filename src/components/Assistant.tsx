import React, { useState } from 'react';
import { useUI, setAssistantOpen } from '../store/ui';
import { ask, CAPABILITIES } from '../store/assistant';
import { Icon } from './Icon';

interface Applied { label: string; at: string }
interface Msg { role: 'user' | 'assistant'; text: string; applied?: Applied[] }

/**
 * Floating, not a panel. Keeps the left column entirely for the transcript and
 * insert tools. Collapses to a circle when the window is narrow.
 */
export const Assistant: React.FC = () => {
  const open = useUI((s) => s.assistantOpen);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    setMsgs((m) => [...m, { role: 'user', text: t }]);
    // Run it against the real project, then report what changed.
    const reply = ask(t);
    setMsgs((m) => [...m, { role: 'assistant', text: reply }]);
  };

  if (!open) {
    return (
      <button className="assist-pill" onClick={() => setAssistantOpen(true)} aria-label="Ask the assistant">
        <span className="assist-mark" />
        <em>Ask Assistant</em>
      </button>
    );
  }

  return (
    <div className="assist" role="dialog" aria-label="Assistant">
      <div className="assist-head">
        <span className="assist-mark" />
        <div>
          <div className="assist-title">Assistant</div>
          <div className="assist-sub">Edits this timeline</div>
        </div>
        <span className="spacer" />
        <button className="icon-btn" aria-label="Close assistant" onClick={() => setAssistantOpen(false)}>
          <Icon n="close" s={15} />
        </button>
      </div>

      <div className="assist-body">
        {!msgs.length && (
          <>
            <p className="hint">Describe an edit and it is applied to the timeline.</p>
            <div className="assist-chips">
              {CAPABILITIES.map((c) => (
                <button key={c} className="assist-chip" onClick={() => { setDraft(c); }}>{c}</button>
              ))}
            </div>
          </>
        )}
        {msgs.map((m, i) => (
          m.role === 'user'
            ? <div key={i} className="assist-user">{m.text}</div>
            : <div key={i} className="assist-reply">{m.text}</div>
        ))}
      </div>

      <div className="assist-foot">
        <button className="icon-btn" aria-label="Voice input"><Icon n="mic" s={16} /></button>
        <input
          className="assist-input"
          value={draft}
          placeholder="Describe an edit"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          aria-label="Describe an edit"
        />
        <button className="assist-send" aria-label="Send" onClick={send} disabled={!draft.trim()}>
          <Icon n="up" s={16} />
        </button>
      </div>
    </div>
  );
};
