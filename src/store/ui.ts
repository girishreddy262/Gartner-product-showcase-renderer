import { useSyncExternalStore } from 'react';

/**
 * Rail tools. 'select' is the home state: the left column shows the transcript.
 * Any other tool swaps its panel into that SAME slot. Returning restores the
 * transcript exactly as it was, which is the whole point of the pattern.
 */
export type RailTool =
  | 'select' | 'media' | 'text' | 'shapes' | 'effects'
  | 'transitions' | 'audio' | 'avatar';

interface TranscriptMemory {
  scrollTop: number;
  focusBlockId: string | null;
  caret: number | null;
}

interface UIState {
  tool: RailTool;
  /** Restored verbatim when the transcript comes back. */
  transcript: TranscriptMemory;
  previewZoom: number;   // 1 = fit
  previewFit: boolean;
  fullscreen: boolean;
  /** The assistant floats over the editor rather than living in the rail. */
  assistantOpen: boolean;
}

let ui: UIState = {
  tool: 'select',
  transcript: { scrollTop: 0, focusBlockId: null, caret: null },
  previewZoom: 1,
  previewFit: true,
  fullscreen: false,
  assistantOpen: false,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const getUI = () => ui;
export function useUI<T>(sel: (s: UIState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(ui), () => sel(ui));
}

/** Remember where the reader was before a panel covers the transcript. */
export function rememberTranscript(m: Partial<TranscriptMemory>) {
  ui = { ...ui, transcript: { ...ui.transcript, ...m } };
}

export function setTool(tool: RailTool) {
  ui = { ...ui, tool };
  emit();
}

/** Arrow, close X and Escape all land here. */
export function backToTranscript() {
  if (ui.tool === 'select') return;
  ui = { ...ui, tool: 'select' };
  emit();
}

export function setPreviewZoom(z: number, fit = false) {
  ui = { ...ui, previewZoom: Math.min(8, Math.max(0.1, z)), previewFit: fit };
  emit();
}

export function fitPreview() {
  ui = { ...ui, previewZoom: 1, previewFit: true };
  emit();
}

export function toggleFullscreen() {
  ui = { ...ui, fullscreen: !ui.fullscreen };
  emit();
}

export function setAssistantOpen(v: boolean) {
  ui = { ...ui, assistantOpen: v };
  emit();
}

export const TOOL_LABELS: Record<RailTool, string> = {
  select: 'Select',
  media: 'Media',
  text: 'Text',
  shapes: 'Shapes',
  effects: 'Effects',
  transitions: 'Transitions',
  audio: 'Audio',
  avatar: 'Avatar',
};

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__fdeUI = {
    getUI, setTool, backToTranscript, setPreviewZoom, fitPreview, rememberTranscript,
  };
}
