#!/usr/bin/env tsx
/**
 * Lambda render script for Product Showcase. (v3.24)
 *
 * Usage:
 *   npx tsx src/render.ts payload.json
 *
 * Triggers a Remotion Lambda render and waits for completion.
 * Writes result to out/render-result.json with the S3 public URL.
 *
 * v3.24 changes:
 *   - framesPerLambda lowered from 150 → 60 (smaller chunks, more parallelism,
 *     individual chunk failures don't kill the whole render)
 *   - maxRetries: 3 per chunk (Remotion auto-retries transient failures)
 *   - Progress callback POSTs to RENDER_PROGRESS_WEBHOOK every poll if set
 *     (so n8n can show a real progress bar instead of a black box)
 *   - Better error logging on fatal failures (full per-chunk errors)
 */
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const REGION = (process.env.REMOTION_REGION || 'ap-south-1') as any;
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME || 'remotion-render-4-0-461-mem2048mb-disk2048mb-240sec';
const SERVE_URL = process.env.REMOTION_SERVE_URL || 'https://remotionlambda-apsouth1-9dlkcsayxl.s3.ap-south-1.amazonaws.com/sites/product-showcase/index.html';
// v3.24: optional webhook to receive progress updates. If set, we POST
// { jobId, renderId, percent, framesRendered, totalFrames, status } every poll.
const PROGRESS_WEBHOOK = process.env.RENDER_PROGRESS_WEBHOOK || '';

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
for (const c of payload.customerCards || []) {
  const end = (c.startMs || 0) + (c.durationMs || 0);
  if (end > maxMs) maxMs = end;
}
const totalMs = Math.max(maxMs, 1000);
const fps = 30;
const frames = Math.ceil((totalMs / 1000) * fps);
const jobId = payload.jobId || 'unknown';

console.log(`🎬 Product Showcase Renderer (Lambda) v3.24`);
console.log(`   Job ID: ${jobId}`);
console.log(`   Module: ${payload.module?.name || 'Untitled'}`);
console.log(`   Segments: ${payload.segments.length}`);
console.log(`   Callouts: ${(payload.callouts || []).length}`);
console.log(`   Text overlays: ${(payload.textOverlays || []).length}`);
console.log(`   Customer cards: ${(payload.customerCards || []).length}`);
console.log(`   Effects: ${(payload.effects || []).length}`);
console.log(`   Audio placements: ${(payload.audioPlacements || []).length}`);
console.log(`   Duration: ${(totalMs / 1000).toFixed(1)}s (${frames} frames @ ${fps}fps)`);
console.log(`   Region: ${REGION}`);
console.log(`   Function: ${FUNCTION_NAME}`);
if (PROGRESS_WEBHOOK) {
  console.log(`   Progress webhook: ${PROGRESS_WEBHOOK}`);
}
console.log(`\n▶ Triggering Lambda render...`);

const startTime = Date.now();

// Post progress to n8n (fire-and-forget — don't await, don't block the poll loop)
async function postProgress(renderId: string, pct: number, framesRendered: number, status: string) {
  if (!PROGRESS_WEBHOOK) return;
  try {
    const body = JSON.stringify({
      jobId, renderId, percent: pct, framesRendered, totalFrames: frames, status,
      elapsedMs: Date.now() - startTime,
    });
    await fetch(PROGRESS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (e) {
    // Don't crash the render if the webhook is down
  }
}

async function main() {
  try {
    // v3.24.3: Dynamic chunk sizing.
    // Remotion caps total Lambda invocations at 200. With 60 frames/chunk, that
    // means we top out at ~6:40 of video. For longer videos, scale up so we stay
    // under 200 chunks, while keeping a 60-frame floor for short videos to preserve
    // the "smaller chunks = better failure isolation" property.
    const MAX_LAMBDAS = 200;
    const MIN_FRAMES_PER_LAMBDA = 60;
    const minRequired = Math.ceil(frames / MAX_LAMBDAS);
    // Add a 10% safety margin so we don't run smack into the limit
    const framesPerLambda = Math.max(MIN_FRAMES_PER_LAMBDA, Math.ceil(minRequired * 1.1));
    const expectedChunks = Math.ceil(frames / framesPerLambda);
    console.log(`   framesPerLambda: ${framesPerLambda} (expected ${expectedChunks} chunks, max ${MAX_LAMBDAS})`);

    const result = await renderMediaOnLambda({
      region: REGION,
      functionName: FUNCTION_NAME,
      serveUrl: SERVE_URL,
      composition: 'ProductShowcase',
      codec: 'h264',
      inputProps: { payload },
      framesPerLambda,
      maxRetries: 3,             // v3.24: retry transient chunk failures
      privacy: 'public',
      outName: `showcase-${jobId}.mp4`,
    });

    console.log(`   Render ID: ${result.renderId}`);
    console.log(`   Bucket: ${result.bucketName}`);
    console.log(`\n▶ Waiting for render to complete...`);

    // Initial progress post — render submitted
    postProgress(result.renderId, 0, 0, 'started');

    let done = false;
    let outputUrl = '';
    let outputSize = 0;
    let lastPostedPct = -1;

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
        postProgress(result.renderId, 100, progress.framesRendered || frames, 'done');
        done = true;
      } else if (progress.fatalErrorEncountered) {
        console.error(`\n❌ Render failed`);
        // v3.24: better error logging — print full error array, not just JSON dump
        const errs = progress.errors || [];
        errs.forEach((err, i) => {
          console.error(`\n   Error ${i + 1}/${errs.length}:`);
          console.error(`     Name: ${err.name || 'unknown'}`);
          console.error(`     Type: ${err.type || 'unknown'}`);
          console.error(`     Chunk: ${err.chunk ?? 'n/a'}`);
          console.error(`     Frame: ${err.frame ?? 'n/a'}`);
          console.error(`     Attempt: ${err.attempt}/${err.totalAttempts}`);
          console.error(`     Message: ${err.message || ''}`);
          if (err.explanation) console.error(`     Hint: ${err.explanation}`);
        });
        postProgress(result.renderId, 0, progress.framesRendered || 0, 'failed');
        process.exit(1);
      } else {
        const pct = Math.round((progress.overallProgress || 0) * 100);
        const rendered = progress.framesRendered || 0;
        process.stdout.write(`\r   Progress: ${pct}% (${rendered}/${frames} frames)`);
        // Post progress on % change to avoid spamming the webhook
        if (pct !== lastPostedPct) {
          postProgress(result.renderId, pct, rendered, 'rendering');
          lastPostedPct = pct;
        }
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
