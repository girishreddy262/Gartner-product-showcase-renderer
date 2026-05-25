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
  animation?: SlideAnimation;
}

// Animation config per slide. Each slide kind supports a different set of animation kinds.
// 'none' = no animation. Default for new slides is 'none'.
export interface SlideAnimation {
  kind: string;          // e.g. 'fade', 'zoom-pan-glow', 'stagger', etc. See per-slide allowed values.
  durationMs?: number;   // animation duration. Defaults are slide-specific.
}

export interface RecordingSegment extends BaseSegment {
  kind: 'recording';
  videoId: string;
  speed: number;
  sourceStartMs: number;
  muteSourceAudio: boolean;
  showFrame: boolean;
  videoScale?: number;  // v3.28b.5: scale factor 0.5–1.5, default 1.0
  audioVolume?: number; // v3.28b.20: 0..1 (or higher) when source audio is on
  // v3.28b.25: per-side crop as 0..1 ratios of source video dimensions
  crop?: { top: number; right: number; bottom: number; left: number };
}

export interface IntroSegment extends BaseSegment {
  kind: 'slide-intro';
  title: string;
  subtitle: string;
  moduleIconId: string | null;          // legacy (v3.27 and earlier) — kept for back-compat
  moduleSlideId?: string | null;        // v3.28b: id of intro module slide design (from intro-modules.ts)
  textStyles: TextStyles;
}

export interface JourneyRow {
  id: string;
  dual: boolean;
  personaIds: (string | null)[];
  customIconUrl?: string | null; // alternative to avatar — uploaded image per row
  useCustomIcon?: boolean; // toggle between avatar and custom icon
  name: string;
  designation: string;
  description: string;
  // Per-row tick glow state:
  //   'inactive'    — gray InactiveTick (no glow)
  //   'glow-static' — full glow from frame 0 (no animation)
  //   'glow-animate'— base shown from frame 0, glow halo animates in 1.0–1.5s
  glowState?: 'inactive' | 'glow-static' | 'glow-animate';
}

export interface JourneyFooterCard {
  enabled: boolean;
  label: string;     // e.g. "Model 2"
  body: string;      // e.g. "Darwinbox (Complete ESS)\nPartner (Processing)"
  showRriveLogo: boolean;
}

// Native zoom owned by a Journey segment. Replaces the generic ZoomEffect for this slide.
// Timing is deterministic: ramps in over first RAMP_MS, holds, ramps out over last RAMP_MS.
// Header (title + footer card + RRIVE logo) opacity is tied to the same zoom progress.
export interface JourneyNativeZoom {
  enabled: boolean;
  focalX: number;   // canvas x (default 1260 — over the ticks column)
  focalY: number;   // canvas y (default 543 — middle row)
  scale: number;    // 1.0 – 2.0 (default 1.4)
  // v3.28b.40: when true, start at full zoom from frame 0 (no zoom-in animation).
  // Tick marks still animate normally — they just start firing immediately.
  startZoomedIn?: boolean;
}

export interface JourneySegment extends BaseSegment {
  kind: 'slide-journey';
  title: string;
  rows: JourneyRow[];
  highlightUpToRow: number; // DEPRECATED. Use row.glowState. Kept for backward compat.
  endJourney: boolean; // when true, last connector segment doesn't extend below last tick
  footerCard?: JourneyFooterCard;
  hideHeader?: boolean; // when true, title + footer card + RRIVE logo are hidden (use during zoom effects)
  journeyZoom?: JourneyNativeZoom; // v3.21: native zoom replaces generic Zoom for this slide
  textStyles: TextStyles;
}

export interface FocusColumn {
  id: string;
  iconId: string | null;
  customIconUrl?: string | null;
  heading: string;
  body: string;       // bullet items separated by newline (used in v1)
}

export interface FocusStatPill {
  id: string;
  iconUrl?: string | null;
  iconKind?: 'locations' | 'clients' | 'configurable' | 'bill' | 'custom'; // For V3 stat bar
  text: string;       // Multi-line — \n separates lines. e.g. "250+\nClients Globally"
  // text2 deprecated — kept for backward compat
  text2?: string;
}

export interface FocusSegment extends BaseSegment {
  kind: 'slide-focus';
  title: string;
  variation: 1 | 2 | 3; // 1=bullets, 2=2 pills, 3=long stat bar
  columns: FocusColumn[];
  statPills?: FocusStatPill[]; // 2 for v2, 4 for v3
  textStyles: TextStyles;
}

export interface KeyGoalsBullet {
  id: string;
  text: string;
}

export interface KeyGoalsCustomerStat {
  id: string;
  iconKind: 'headcount' | 'industry' | 'countries' | 'custom';
  customIconUrl?: string | null;
  text: string; // e.g. "20k+ Employees"
}

export interface KeyGoalsSegment extends BaseSegment {
  kind: 'slide-keygoals';
  title: string;
  bullets: KeyGoalsBullet[];           // legacy left as-is, now treated as goals
  customerLogoUrl?: string | null;
  customerStats?: KeyGoalsCustomerStat[];
  mapHighlightCountries?: string[];    // ISO codes or names selected in property panel
  textStyles: TextStyles;
}

export interface EmptySegment extends BaseSegment {
  kind: 'slide-empty';
  title: string;
  textStyles: TextStyles;
}

// v3.28b.2: Divider slide — icon + subtitle (Bold 60 #0183FF) + title (Bold 116 #003B73)
// on #EDF6FF background. Hiding subtitle or title auto-fits the layout.
// All icons share the same baseline (bottom edge).
export interface DividerSegment extends BaseSegment {
  kind: 'slide-divider';
  title: string;          // multi-line OK (use \n)
  subtitle: string;       // optional — empty hides
  iconId: string;         // ID from DIVIDER_ICONS library
  textStyles: TextStyles;
}


// v3.28b.5: full-bleed image slide — uploaded JPEG/PNG fills the 1920x1080 canvas
// with a simple fade-in animation.
// v3.28b.51: + optional navy frame overlay + scale slider (50-150%)
export interface ImageSegment extends BaseSegment {
  kind: 'slide-image';
  imageUrl: string;
  filename?: string;
  showFrame?: boolean;     // default false; user toggles in edit panel
  imageScale?: number;     // 0.5-1.5 (50-150%); default 1.0
}

export type Segment =
  | RecordingSegment
  | IntroSegment
  | JourneySegment
  | FocusSegment
  | KeyGoalsSegment
  | EmptySegment
  | DividerSegment
  | ImageSegment;

export type SlideSegment = Exclude<Segment, RecordingSegment | ImageSegment>;

// --- Overlays ---

export interface AudioPlacement {
  id: string;
  audioId: string;
  startMs: number;
  durationMs: number;
  volume: number;
  // v3.28b.50: offset into the source audio file (set when a placement is sliced)
  sourceStartMs?: number;
}

export interface Callout {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  startMs: number;
  durationMs: number;
  // Animation properties (same as text overlay)
  animIn?: string;
  animInAt?: number;
  animOut?: string;
  animOutAt?: number;
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

// New: customer card overlay (like callout/text — draggable, with animations)
export interface CustomerCardOverlay {
  id: string;
  x: number;
  y: number;
  startMs: number;
  durationMs: number;
  logoUrl?: string | null;       // legacy (v3.27 and earlier) — explicit URL string
  customerLogoId?: string | null; // v3.28b: id from customer-logos.ts library (preferred)
  employees: string;     // e.g. "1.5K+"
  industry: string;      // e.g. "Data Solutions & Analytics"
  location: string;      // e.g. "USA"
  body: string;          // description text
  // Animation properties
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
  customerCards?: CustomerCardOverlay[];
  frameUrl?: string;
  jobId: string;
}
