/** Every lane item lives on the timeline and carries a duration. */
export interface TimedBase {
  id: string;
  /** Absolute position, used when the item is not anchored to a script block. */
  startMs: number;
  durationMs: number;
  /** When set, startMs is DERIVED from the block's start plus offsetMs. */
  anchorBlockId?: string | null;
  offsetMs?: number;
  /** Pinned items keep absolute time even when their block moves. */
  pinned?: boolean;
}

/** Whether the bytes are only in this browser, or actually stored. Anything
 *  server-side (transcribe, render, lip-sync) needs 'stored'. */
export type UploadState = 'local' | 'uploading' | 'stored' | 'failed';

export interface MediaAsset {
  /** Small 16kHz mono copy used for transcription, since sending video
   *  through a Worker exceeds its memory limit on anything long. */
  audioKey?: string;
  uploadState?: UploadState;
  uploadPct?: number;
  uploadError?: string;
  id: string;
  kind: 'video' | 'audio' | 'image';
  url: string;
  name: string;
  durationMs: number;
  width?: number;
  height?: number;
}

/**
 * 'recording' is the main picture (screen or a single camera take).
 * 'camera' is a face track recorded alongside a screen take. It stays a
 * SEPARATE segment rather than being burned into the screen video, so the
 * bubble can be moved, resized and reshaped after the fact.
 */
export interface AudioPlacement extends TimedBase {
  audioId: string;
  /** set when this narration belongs to a transcript block */
  blockId?: string;
  label: string;
  gain: number;
  sourceStartMs?: number;
}

export type SegmentKind = 'recording' | 'camera';
export type CameraShape = 'circle' | 'rounded' | 'square';

export interface Segment extends TimedBase {
  kind: SegmentKind;
  videoId: string;
  /** Which transcript paragraph this footage belongs to. Set once the
   *  transcript exists, so cutting words can cut the matching video. */
  blockId?: string;
  sourceStartMs: number;
  speed?: number;
  /** Freeze the last frame for this long after the footage runs out. Used when
   *  the voice is longer than the picture it narrates. */
  holdTailMs?: number;
  muteSourceAudio?: boolean;
  /** camera segments only */
  size?: number;
  shape?: CameraShape;
  /** framing, on every segment: scale is a zoom, x/y pan within the frame */
  scale?: number;
  x?: number;
  y?: number;
  /** crop as a fraction of the source frame, 0..1 from each edge */
  cropTop?: number;
  cropRight?: number;
  cropBottom?: number;
  cropLeft?: number;
}

/** Where a block's audio comes from. The badge, and the consequences, differ. */
export type BlockSource = 'recorded' | 'generated';

export interface Word {
  text: string;
  startMs: number;
  endMs: number;
  /** Struck out of the script. The word stays put so it can be restored by
   *  right-clicking it, exactly as the previous editor worked. */
  del?: boolean;
  /** Silence held after this word, in ms. */
  pauseAfterMs?: number;
  /** Dead air removed after this word, kept so tightening can be undone. */
  gapTrimMs?: number;
  /** Typed in rather than spoken. There is no footage behind it. */
  added?: boolean;
}

/**
 * Pins a word in the script to a moment in the footage.
 *
 * A generated voice is never the same length as the speech it replaces, so
 * without pins every regeneration shifts everything after it and the narration
 * slowly stops matching the screen. Between two pins the footage is stretched
 * or held so the words keep landing where they should.
 */
export interface SyncPoint {
  id: string;
  blockId: string;
  /** Index into that block's words. The pin sits before this word. */
  wordIndex: number;
  /** Where in the ORIGINAL footage this moment lives. */
  sourceMs: number;
  /** Set when the user moved it, so regeneration leaves it alone. */
  manual?: boolean;
}

/** A point where the voice changes. Everything from here uses this voice. */
export interface VoiceSection {
  /** Word index the section starts at. */
  w: number;
  voiceId: string;
  voiceName: string;
}

/** One paragraph of script. Block durations drive all timing. */
export interface Block {
  id: string;
  text: string;
  source: BlockSource;
  /** Only present on recorded blocks; drives word-level cutting. */
  words?: Word[];
  /** Voice changes inside this block, by word index. */
  voiceSections?: VoiceSection[];
  /** Set when a recorded block has been replaced by a generated voice. */
  overRecording?: boolean;
  voiceId?: string;
  voiceName?: string;
  /** true only when the user deliberately gave this block a different voice */
  voiceOverride?: boolean;
  audioUrl?: string | null;
  /** Stored copy of the narration. audioUrl is a local blob that dies with the
   *  tab; anything outside the browser needs this. */
  audioKey?: string;
  /** Per-block playback of the generated voice. Applied at render, so
   *  changing them costs nothing and needs no regeneration. */
  volume?: number;
  speed?: number;
  /** Per-block overrides of the project voice settings. Undefined means
   *  follow the project. */
  settings?: Partial<VoiceSettings>;
  durationMs: number;
  dirty: boolean;
  takes: { at: number; url: string }[];
}

/**
 * Derived by the assistant from what the video actually covers, not a fixed
 * Intro/Body/Outro template. Spans several blocks. Editable.
 */
export interface Section {
  id: string;
  title: string;
  /** Index of the first block this section covers. */
  fromBlock: number;
}

/**
 * A gesture clip. An avatar is a SET of these, not one video, so the presenter
 * can change posture between sections instead of looping one pose forever.
 */
export interface GestureClip {
  id: string;
  /** matches a GESTURE key below */
  gesture: string;
  /** S3 key, or a blob url until the upload finishes */
  url: string;
  durationMs: number;
}

export type AvatarStatus = 'draft' | 'preparing' | 'ready' | 'failed';

export interface Avatar {
  id: string;
  name: string;
  /** true for the shipped library, false for one the user recorded */
  builtIn: boolean;
  status: AvatarStatus;
  /** consent is recorded before any likeness is stored, and is not optional */
  consentClipUrl?: string;
  consentAt?: number;
  clips: GestureClip[];
  /** returned by the lip-sync provider once the face model is prepared */
  modelRef?: string;
  error?: string;
}

/**
 * The prompts the wizard walks through. Order matters: consent first, then the
 * two that everything else falls back to, then the optional ones.
 */
export const GESTURES = [
  { key: 'consent',    label: 'Consent',    seconds: 15, required: true,
    prompt: 'Read this aloud: I agree that my likeness and voice may be used to create a digital avatar of me.' },
  { key: 'idle',       label: 'Idle',       seconds: 10, required: true,
    prompt: 'Look at the lens and stay still. Breathe normally. This plays between lines.' },
  { key: 'talking',    label: 'Talking',    seconds: 15, required: true,
    prompt: 'Speak naturally, as if explaining something to a colleague.' },
  { key: 'explaining', label: 'Explaining', seconds: 12, required: false,
    prompt: 'Speak with open hands, as if walking someone through an idea.' },
  { key: 'pointing',   label: 'Pointing',   seconds: 8,  required: false,
    prompt: 'Gesture to your side, as if drawing attention to something on screen.' },
  { key: 'welcoming',  label: 'Welcoming',  seconds: 8,  required: false,
    prompt: 'Greet the camera, as you would at the start of a video.' },
] as const;

export const REQUIRED_GESTURES = GESTURES.filter((g) => g.required).map((g) => g.key);

/** ElevenLabs voice parameters. v3 exposes stability as three discrete modes. */
export type Stability = 'creative' | 'natural' | 'robust';

export interface VoiceSettings {
  voiceId?: string;
  voiceName?: string;
  stability: Stability;
  similarity: number;   // 0..1
  style: number;        // 0..1
  speed: number;        // 0.7..1.2
  speakerBoost: boolean;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 'natural',
  similarity: 0.75,
  style: 0,
  speed: 1,
  speakerBoost: true,
};

export type CalloutType = 'pill' | 'bar' | 'bubble' | 'glass' | 'num';

export interface Callout extends TimedBase {
  text: string;
  x: number;
  y: number;
  coType: CalloutType;
}

export interface TextOverlay extends TimedBase {
  fontFamily?: string;
  fontWeight?: string;
  lineHeight?: number;
  letterSpacing?: number;
  align?: string;
  opacity?: number;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

export type ShapeKind = 'rect' | 'roundedRect' | 'ellipse' | 'polygon' | 'star';

export interface Shape extends TimedBase {
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  rotation: number;
  /** roundedRect only */
  radius: number;
  /** polygon and star */
  sides: number;
  /** star only, as a fraction of the outer radius */
  innerRatio: number;
}

export const SHAPE_DEFAULTS: Record<ShapeKind, Partial<Shape>> = {
  rect:         { width: 400, height: 240, radius: 0,  sides: 4, innerRatio: 0.5 },
  roundedRect:  { width: 400, height: 240, radius: 24, sides: 4, innerRatio: 0.5 },
  ellipse:      { width: 320, height: 320, radius: 0,  sides: 4, innerRatio: 0.5 },
  polygon:      { width: 320, height: 320, radius: 0,  sides: 6, innerRatio: 0.5 },
  star:         { width: 320, height: 320, radius: 0,  sides: 5, innerRatio: 0.45 },
};

export interface Effect extends TimedBase {
  type: 'zoom' | 'spotlight';
  x: number;
  y: number;
  scale?: number;
}

export type LaneKey = 'segments' | 'camera' | 'voice' | 'music' | 'blocks' | 'callouts' | 'textOverlays' | 'shapes' | 'effects';

export interface Project {
  id: string;
  name: string;
  updatedAt: number;
  media: MediaAsset[];
  segments: Segment[];
  camera: Segment[];
  /** Generated narration, one item per block that has audio. */
  voice: AudioPlacement[];
  /** Music and sound effects. */
  music: AudioPlacement[];
  blocks: Block[];
  callouts: Callout[];
  textOverlays: TextOverlay[];
  shapes: Shape[];
  effects: Effect[];
  syncPoints: SyncPoint[];
  sections: Section[];
  /** Avatars live on the project until workspaces exist, then they move up. */
  avatars: Avatar[];
  /** Shape of the canvas, an authoring decision. */
  aspect: AspectKey;
  /** Output size is an EXPORT decision, so it is asked for in the export
   *  dialog rather than up front. Kept here only as the remembered default. */
  resolution: ResolutionKey;
  voiceSettings: VoiceSettings;
  background: { value: string };
}

export interface Selection {
  lane: LaneKey | null;
  id: string | null;
}

/** Output resolutions the project can be set to. */
export const RESOLUTIONS = [
  { key: '720p', label: '720p', w: 1280, h: 720 },
  { key: '1080p', label: '1080p', w: 1920, h: 1080 },
  { key: '2k', label: '2K', w: 2560, h: 1440 },
  { key: '4k', label: '4K', w: 3840, h: 2160 },
] as const;
export type ResolutionKey = typeof RESOLUTIONS[number]['key'];

export const ASPECTS = [
  { key: '16:9', label: '16:9', w: 1920, h: 1080 },
  { key: '9:16', label: '9:16', w: 1080, h: 1920 },
  { key: '1:1',  label: '1:1',  w: 1080, h: 1080 },
  { key: '4:5',  label: '4:5',  w: 1080, h: 1350 },
] as const;
export type AspectKey = typeof ASPECTS[number]['key'];

/** Overlay coordinates are always authored against this, then scaled at render
 *  time, so changing the output resolution never moves anything. */
export const CANVAS_W = 1920;
export const CANVAS_H = 1080;
/** Nothing may be shorter than this. Zero-length items are not representable. */
export const MIN_DURATION_MS = 100;
