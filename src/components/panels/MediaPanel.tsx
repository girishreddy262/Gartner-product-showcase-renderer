import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/project';
import { importFiles } from '../../store/media';
import { fmt } from '../../lib/time';
import { Icon } from '../Icon';
import { frameFrom } from '../../store/avatars';
import { playableUrl, retryUpload, removeMedia, removeFailedMedia } from '../../store/media';
import type { MediaAsset } from '../../store/types';

/** A still from the file, so the list reads as footage rather than filenames. */
const Thumb: React.FC<{ asset: MediaAsset }> = ({ asset }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    playableUrl(asset)
      .then((u) => frameFrom(u))
      .then((f) => { if (live) setSrc(f); })
      .catch(() => {});
    return () => { live = false; };
  }, [asset.id, asset.url]);
  return (
    <span className="m-thumb">
      {src ? <img src={src} alt="" /> : <Icon n={asset.kind === 'audio' ? 'music' : 'image'} s={14} />}
    </span>
  );
};

export const MediaPanel: React.FC<{ onRecord?: (src: 'screen' | 'camera' | 'both') => void }> = ({ onRecord }) => {
  const media = useStore((s) => s.project.media);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="panel-body">
      <div className="rec-tiles">
        <button onClick={() => onRecord?.('screen')} aria-label="Record screen">
          <Icon n="screen" s={18} /><em>Screen</em>
        </button>
        <button onClick={() => onRecord?.('camera')} aria-label="Record camera">
          <Icon n="cam" s={18} /><em>Camera</em>
        </button>
        <button onClick={() => onRecord?.('both')} aria-label="Record screen and camera">
          <Icon n="both" s={18} /><em>Both</em>
        </button>
      </div>
      <button className="import-btn" onClick={() => input.current?.click()} aria-label="Import media">
        Import a file
      </button>
      <input
        ref={input}
        type="file"
        accept="video/*,audio/*"
        multiple
        hidden
        onChange={(e) => {
          const f = Array.from(e.target.files || []);
          if (f.length) importFiles(f);
          e.target.value = '';
        }}
      />
      {media.some((m) => !m.url || m.uploadState === 'failed') && (
        <button
          className="act clean-row"
          onClick={() => removeFailedMedia()}
          aria-label="Remove every file that failed to upload"
        >
          Remove all failed files
        </button>
      )}

      {!media.length
        ? <p className="hint">Drop a file anywhere in the editor, or import one. Video lands on the timeline straight away.</p>
        : (
          <ul className="media-list">
            {media.map((m) => (
              <li key={m.id} data-state={m.uploadState || 'stored'}>
                <Thumb asset={m} />
                <span className="media-meta">
                  <span className="media-name">{m.name}</span>
                  <span className="media-sub">
                    {m.uploadState === 'failed'
                      ? <span className="media-bad">{m.uploadError || 'upload failed'}</span>
                      : m.uploadState === 'uploading'
                        ? `Uploading ${Math.round((m.uploadPct || 0) * 100)}%`
                        : fmt(m.durationMs)}
                  </span>
                </span>
                <span className="m-actions">
                  {m.uploadState === 'failed' && m.url
                    ? <button className="act" onClick={() => retryUpload(m.id)} aria-label={`Retry uploading ${m.name}`}>Retry</button>
                    : m.uploadState === 'uploading'
                      ? <span className="up-bar"><i style={{ width: `${Math.round((m.uploadPct || 0) * 100)}%` }} /></span>
                      : m.url ? <span className="up-ok" aria-label="Stored" /> : null}
                  <button
                    className="icon-btn m-del"
                    aria-label={`Remove ${m.name}`}
                    title="Remove this file and any clips using it"
                    onClick={() => removeMedia(m.id)}
                  >
                    <Icon n="trash" s={13} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
};
