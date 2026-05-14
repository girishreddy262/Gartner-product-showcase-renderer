#!/usr/bin/env tsx
/**
 * CLI render script for Product Showcase.
 *
 * Usage:
 *   npx tsx src/render.ts payload.json [output.mp4]
 *
 * Called by GitHub Actions with the approved payload from n8n.
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: npx tsx src/render.ts <payload.json> [output.mp4]');
  process.exit(1);
}

const payloadPath = resolve(args[0]);
const outputPath = resolve(args[1] || 'out/output.mp4');

if (!existsSync(payloadPath)) {
  console.error(`Payload file not found: ${payloadPath}`);
  process.exit(1);
}

// Read payload
const rawPayload = readFileSync(payloadPath, 'utf-8');
const payload = JSON.parse(rawPayload);

// Validate basic structure
if (!payload.segments || !Array.isArray(payload.segments)) {
  console.error('Invalid payload: missing segments array');
  process.exit(1);
}

// Calculate total duration
let maxMs = 0;
for (const s of payload.segments) {
  const end = (s.startMs || 0) + (s.durationMs || 0);
  if (end > maxMs) maxMs = end;
}
for (const c of payload.callouts || []) {
  const end = (c.startMs || 0) + (c.durationMs || 0);
  if (end > maxMs) maxMs = end;
}
for (const t of payload.textOverlays || []) {
  const end = (t.startMs || 0) + (t.durationMs || 0);
  if (end > maxMs) maxMs = end;
}
const totalMs = Math.max(maxMs, 1000);
const fps = 30;
const frames = Math.ceil((totalMs / 1000) * fps);

console.log(`🎬 Product Showcase Renderer`);
console.log(`   Job ID: ${payload.jobId || 'unknown'}`);
console.log(`   Module: ${payload.module?.name || 'Untitled'}`);
console.log(`   Segments: ${payload.segments.length}`);
console.log(`   Callouts: ${(payload.callouts || []).length}`);
console.log(`   Text overlays: ${(payload.textOverlays || []).length}`);
console.log(`   Effects: ${(payload.effects || []).length}`);
console.log(`   Audio placements: ${(payload.audioPlacements || []).length}`);
console.log(`   Duration: ${(totalMs / 1000).toFixed(1)}s (${frames} frames @ ${fps}fps)`);
console.log(`   Output: ${outputPath}`);

// Ensure output directory exists
const outDir = dirname(outputPath);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// Set payload as env var for Remotion to pick up
process.env.REMOTION_PAYLOAD = rawPayload;

// Run Remotion render
const cmd = [
  'npx remotion render',
  'src/index.tsx',
  'ProductShowcase',
  `"${outputPath}"`,
  `--frames=${frames}`,
  `--props='${JSON.stringify({ payload })}'`,
  '--codec=h264',
  '--image-format=jpeg',
  '--quality=80',
  '--concurrency=2',  // GitHub Actions has 2 cores
  '--log=verbose',
].join(' ');

console.log(`\n▶ Rendering...`);

try {
  execSync(cmd, { stdio: 'inherit', cwd: resolve(__dirname, '..') });
  console.log(`\n✅ Render complete: ${outputPath}`);
} catch (e) {
  console.error('\n❌ Render failed');
  process.exit(1);
}
