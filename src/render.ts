#!/usr/bin/env tsx
/**
 * Lambda render script for Product Showcase.
 *
 * Usage:
 *   npx tsx src/render.ts payload.json
 *
 * Triggers a Remotion Lambda render and waits for completion.
 * Writes result to out/render-result.json with the S3 public URL.
 */
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const REGION = (process.env.REMOTION_REGION || 'ap-south-1') as any;
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME || 'remotion-render-4-0-461-mem2048mb-disk2048mb-240sec';
const SERVE_URL = process.env.REMOTION_SERVE_URL || 'https://remotionlambda-apsouth1-9dlkcsayxl.s3.ap-south-1.amazonaws.com/sites/product-showcase/index.html';
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: npx tsx src/render.ts <payload.json>');
  process.exit(1);
}

const payloadPath = resolve(args[0]);
if (!existsSync(payloadPath)) {
  console.error(`Payload file not found: ${payloadPath}`);
  process.exit(1);
}

const rawPayload = readFileSync(payloadPath, 'utf-8');
const payload = JSON.parse(rawPayload);

if (!payload.segments || !Array.isArray(payload.segments)) {
  console.error('Invalid payload: missing segments array');
  process.exit(1);
}

// Calculate total duration for logging
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
const jobId = payload.jobId || 'unknown';

console.log(`🎬 Product Showcase Renderer (Lambda)`);
console.log(`   Job ID: ${jobId}`);
console.log(`   Module: ${payload.module?.name || 'Untitled'}`);
console.log(`   Segments: ${payload.segments.length}`);
console.log(`   Callouts: ${(payload.callouts || []).length}`);
console.log(`   Text overlays: ${(payload.textOverlays || []).length}`);
console.log(`   Effects: ${(payload.effects || []).length}`);
console.log(`   Audio placements: ${(payload.audioPlacements || []).length}`);
console.log(`   Duration: ${(totalMs / 1000).toFixed(1)}s (${frames} frames @ ${fps}fps)`);
console.log(`   Region: ${REGION}`);
console.log(`   Function: ${FUNCTION_NAME}`);
console.log(`\n▶ Triggering Lambda render...`);

const startTime = Date.now();

async function main() {
  try {
    const result = await renderMediaOnLambda({
      region: REGION,
      functionName: FUNCTION_NAME,
      serveUrl: SERVE_URL,
      composition: 'ProductShowcase',
      codec: 'h264',
      inputProps: { payload },
      framesPerLambda: 150,
      privacy: 'public',
      outName: `showcase-${jobId}.mp4`,
    });

    console.log(`   Render ID: ${result.renderId}`);
    console.log(`   Bucket: ${result.bucketName}`);
    console.log(`\n▶ Waiting for render to complete...`);

    let done = false;
    let outputUrl = '';
    let outputSize = 0;

    while (!done) {
      await new Promise(r => setTimeout(r, 2000));
      const progress = await getRenderProgress({
        renderId: result.renderId,
        bucketName: result.bucketName,
        functionName: FUNCTION_NAME,
        region: REGION,
      });

      if (progress.done) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        outputUrl = `https://${result.bucketName}.s3.${REGION}.amazonaws.com/${progress.outKey}`;
        outputSize = progress.outputSizeInBytes || 0;
        console.log(`\n✅ Render complete in ${elapsed}s`);
        console.log(`   Output: ${outputUrl}`);
        console.log(`   Size: ${(outputSize / 1024 / 1024).toFixed(1)} MB`);
        console.log(`   Cost: ${progress.costs?.displayCost || '$0'}`);
        done = true;
      } else if (progress.fatalErrorEncountered) {
        console.error(`\n❌ Render failed`);
        console.error(`   Errors: ${JSON.stringify(progress.errors)}`);
        process.exit(1);
      } else {
        const pct = Math.round((progress.overallProgress || 0) * 100);
        const rendered = progress.framesRendered || 0;
        process.stdout.write(`\r   Progress: ${pct}% (${rendered}/${frames} frames)`);
      }
    }

    // Write result for GitHub Actions to read
    mkdirSync(resolve('out'), { recursive: true });
    writeFileSync(resolve('out', 'render-result.json'), JSON.stringify({
      status: 'success',
      mp4Url: outputUrl,
      outputSize,
      renderId: result.renderId,
      bucketName: result.bucketName,
      jobId,
      elapsedMs: Date.now() - startTime,
    }));
    console.log(`   Result written to: out/render-result.json`);

  } catch (e: any) {
    console.error(`\n❌ Lambda render error: ${e.message}`);
    process.exit(1);
  }
}

main();
