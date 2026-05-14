/**
 * Type definitions for the Product Showcase Editor payload.
 * These mirror exactly what the editor sends on approve.
 */

export interface Module {
  name: string;
}

export interface Video {
  id: string;
  url: string;
  filename?: string;
}

export interface Audio {
  id: string;
  url: string;
  filename?: string;
}

export interface TextStyle {
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  color?: string;
  animation?: {
    in: string;
    inAt: number;
    out: string;
    outAt: number;
  } | null;
}

export interface TextStyles {
  [key: string]: TextStyle;
}

// --- Segment types ---

interface BaseSegment {
  id: string;
  startMs: number;
  durationMs: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RecordingSegment extends BaseSegment {
  kind: 'recording';
  videoId: string;
  speed: number;
  sourceStartMs: number;
  muteSourceAudio: boolean;
  showFrame: boolean;
}

export interface IntroSegment extends BaseSegment {
  kind: 'slide-intro';
  title: string;
  subtitle: string;
  moduleIconId: string | null;
  textStyles: TextStyles;
}

export interface JourneyRow {
  id: string;
  dual: boolean;
  personaIds: (string | null)[];
  name: string;
  designation: string;
  description: string;
}

export interface JourneySegment extends BaseSegment {
  kind: 'slide-journey';
  title: string;
  rows: JourneyRow[];
  textStyles: TextStyles;
}

export interface FocusColumn {
  id: string;
  iconId: string | null;
  heading: string;
  body: string;
}

export interface FocusSegment extends BaseSegment {
  kind: 'slide-focus';
  title: string;
  columns: FocusColumn[];
  textStyles: TextStyles;
}

export interface KeyGoalsBullet {
  id: string;
  text: string;
}

export interface KeyGoalsSegment extends BaseSegment {
  kind: 'slide-keygoals';
  title: string;
  bullets: KeyGoalsBullet[];
  textStyles: TextStyles;
}

export interface EmptySegment extends BaseSegment {
  kind: 'slide-empty';
  title: string;
  textStyles: TextStyles;
}

export type Segment =
  | RecordingSegment
  | IntroSegment
  | JourneySegment
  | FocusSegment
  | KeyGoalsSegment
  | EmptySegment;

export type SlideSegment = Exclude<Segment, RecordingSegment>;

// --- Overlays ---

export interface AudioPlacement {
  id: string;
  audioId: string;
  startMs: number;
  durationMs: number;
  volume: number;
}

export interface Callout {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  startMs: number;
  durationMs: number;
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  color: string;
  startMs: number;
  durationMs: number;
  animIn: string;
  animInAt: number;
  animOut: string;
  animOutAt: number;
}

export interface ZoomEffect {
  id: string;
  kind: 'zoom';
  x: number;
  y: number;
  scale: number;
  startMs: number;
  durationMs: number;
}

export interface SpotlightEffect {
  id: string;
  kind: 'spotlight';
  x: number;
  y: number;
  w: number;
  h: number;
  startMs: number;
  durationMs: number;
}

export type Effect = ZoomEffect | SpotlightEffect;

// --- Full Payload ---

export interface ShowcasePayload {
  module: Module;
  videos: Video[];
  audios: Audio[];
  segments: Segment[];
  audioPlacements: AudioPlacement[];
  callouts: Callout[];
  effects: Effect[];
  textOverlays: TextOverlay[];
  frameUrl?: string;
  jobId: string;
}
