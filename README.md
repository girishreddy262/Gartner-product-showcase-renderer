# Product Showcase Renderer

Remotion-based video renderer for the Darwinbox Product Showcase Editor. Takes the JSON payload from the editor's "Approve" action and renders a final MP4 video with all slides, screen recordings, text overlays, callouts, effects, and audio.

## Architecture

```
n8n Editor (approve) → GitHub Actions (repository_dispatch) → Remotion render → MP4 artifact → n8n callback
```

### Payload flow

1. User approves in the editor at `darwinbox.app.n8n.cloud`
2. n8n's Wait node receives the payload and triggers GitHub Actions via `repository_dispatch`
3. This repo's workflow decodes the payload, runs `npx tsx src/render.ts payload.json`
4. Remotion renders each segment as a `<Sequence>`, composites overlays, mixes audio
5. Output MP4 uploaded as GitHub Actions artifact
6. Callback to n8n with status + artifact URL

### What gets rendered

| Editor Feature | Remotion Component | Notes |
|---|---|---|
| Intro slide | `SlideRenderer` → `IntroSlide` | Gradient bg, icon, title, subtitle |
| Journey slide | `SlideRenderer` → `JourneySlide` | Persona rows, dual mode |
| Focus Areas | `SlideRenderer` → `FocusSlide` | Column grid with icons |
| Key Goals | `SlideRenderer` → `KeyGoalsSlide` | Bullet list with icons |
| Empty slide | `SlideRenderer` → `EmptySlide` | Dark background |
| Screen recording | `RecordingComp` | Variable speed, source offset, frame overlay |
| Text overlay | `TextOverlayComp` | Font/weight/color + fade/slide animations |
| Callout | `CalloutComp` | Blue gradient box with yellow border |
| Zoom effect | `useZoomTransform` | Smooth scale with ease in/out |
| Spotlight | `SpotlightComp` | Box-shadow dimming cutout |
| Audio | Remotion `<Audio>` | Volume control, positioned on timeline |
| Text styles | `textStyle()` helper | Per-element font/weight/italic/color overrides |

## Setup

```bash
npm install
```

## Local preview

```bash
npx remotion preview src/index.ts
```

This opens the Remotion Studio where you can preview compositions. To test with real data, set `REMOTION_PAYLOAD` env var to the JSON payload.

## Local render

```bash
npx tsx src/render.ts payload.json out/output.mp4
```

## GitHub Actions trigger

From n8n, POST to the GitHub API:

```
POST https://api.github.com/repos/{owner}/{repo}/dispatches
Authorization: Bearer {GITHUB_PAT}
Content-Type: application/json

{
  "event_type": "render-showcase",
  "client_payload": {
    "payload": { ...editor payload... },
    "callbackUrl": "https://darwinbox.app.n8n.cloud/webhook/render-callback"
  }
}
```

## Manual trigger

Base64-encode the payload and trigger via workflow_dispatch:

```bash
cat payload.json | base64 -w0 | pbcopy
# Then paste in GitHub Actions → Run workflow → payload_json
```

## Project structure

```
src/
├── index.ts              # Remotion entry, registers composition
├── Root.tsx              # Main composition: orchestrates sequences
├── render.ts             # CLI render script
├── types.ts              # TypeScript types matching editor payload
├── tokens.ts             # Design tokens (colors, dimensions)
├── assets.ts             # Dropbox asset URLs
├── slides/
│   └── SlideRenderer.tsx # All 5 slide type components
├── overlays/
│   ├── TextOverlay.tsx   # Animated text overlay
│   └── Callout.tsx       # Callout box
└── effects/
    └── Effects.tsx       # Zoom transform + spotlight
```

## Font handling

Satoshi fonts are loaded from Dropbox URLs via `@font-face` in the composition. Remotion's headless Chrome fetches them at render time. No local font files needed.

## n8n integration

The n8n workflow at `darwinbox.app.n8n.cloud` (workflow `eV53wN2d6mSC5GcQ`) needs a new node after the Wait node that:

1. Receives the approved payload from the editor
2. POSTs to GitHub API to trigger this workflow
3. Optionally polls/waits for callback with the render status

The callback URL should point to a webhook in n8n that marks the job as complete and provides the artifact download link.
