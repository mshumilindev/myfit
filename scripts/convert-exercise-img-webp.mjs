#!/usr/bin/env node
// Converts client/public/exercise-img/**/*.jpg -> .webp (same basename, quality 78, max width 1200).
// Idempotent: skips jpgs whose .webp already exists. Resume-safe: writes to a temp file, then renames.
// Usage: node scripts/convert-exercise-img-webp.mjs [--budget-ms=150000] [--dir=client/public/exercise-img]
// Exit code 0 when finished, 2 when the time budget ran out (run again to continue).
import { readdir, stat, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const DIR = path.resolve(ROOT, arg('dir', 'client/public/exercise-img'));
const BUDGET = Number(arg('budget-ms', '150000'));
const QUALITY = 78;
const MAX_W = 1200;
const CONCURRENCY = 4;
const started = Date.now();

async function* walk(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.jpe?g$/i.test(e.name)) yield p;
  }
}
const exists = (p) =>
  stat(p).then(
    () => true,
    () => false,
  );

const files = [];
for await (const f of walk(DIR)) files.push(f);
files.sort();

let done = 0,
  skipped = 0,
  failed = 0,
  before = 0,
  after = 0,
  i = 0,
  outOfTime = false;
async function worker() {
  while (i < files.length) {
    if (Date.now() - started > BUDGET) {
      outOfTime = true;
      return;
    }
    const src = files[i++];
    const out = src.replace(/\.jpe?g$/i, '.webp');
    if (await exists(out)) {
      skipped++;
      continue;
    }
    try {
      const tmp = `${out}.tmp`;
      await sharp(src)
        .rotate()
        .resize({ width: MAX_W, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(tmp);
      await rename(tmp, out);
      before += (await stat(src)).size;
      after += (await stat(out)).size;
      done++;
    } catch (e) {
      failed++;
      console.error('FAIL', src, e.message);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const mb = (n) => (n / 1048576).toFixed(1);
console.log(
  `total jpg: ${files.length}, converted now: ${done}, already had webp: ${skipped}, failed: ${failed}`,
);
if (done)
  console.log(
    `this run: ${mb(before)} MB -> ${mb(after)} MB (ratio ${(after / before).toFixed(3)})`,
  );
if (outOfTime) {
  console.log('time budget exhausted, run again to continue');
  process.exit(2);
}
if (failed) process.exit(1);
