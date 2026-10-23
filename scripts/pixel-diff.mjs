#!/usr/bin/env node
/* global document -- the page functions run inside the story iframe */
/**
 * Pixel audit (SPO-344/SPO-59, ADR 010): proves a CSS/token refactor changed nothing the eye can
 * see. Screenshots every Storybook story (full page, animations off, fixed viewport widths) into
 * --dir, and with --ref compares each PNG byte-for-byte (decoded RGBA) with the reference set.
 * A refactor that must be invisible is: shoot a reference BEFORE, change, shoot --ref AFTER.
 *
 *   npm run build-storybook && npx http-server client/storybook-static -p 6006 &
 *   npm run audit:pixels -- --dir shots-ref                       # make the reference
 *   npm run audit:pixels -- --dir shots-new --ref shots-ref       # shoot + compare, exit 1 on any diff
 *   options: --url <storybook> --widths 390,1280 --concurrency 3 --filter <story-id substring>
 *            --theme <id> / --mode / --accent / --density <value> (Storybook globals)
 *            --compare-only (no shooting; compare --dir against --ref)
 *
 * CI keeps the reference as an artifact of the main branch; a diff lists the story, the width and
 * how many pixels moved, and the new PNG is next to the reference for a look.
 */
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { runPool } from './lib/pool.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const flag = (k) => process.argv.includes(`--${k}`);
const url = arg('url', 'http://127.0.0.1:6006');
const dir = arg('dir', 'shots');
const ref = arg('ref', '');
const widths = arg('widths', '390,1280').split(',').map(Number);
const concurrency = Number(arg('concurrency', '3'));
const filter = arg('filter', '');
const globals = ['theme', 'mode', 'accent', 'density']
  .filter((k) => arg(k, ''))
  .map((k) => `${k}:${arg(k, '')}`)
  .join(';');

async function shoot() {
  fs.mkdirSync(dir, { recursive: true });
  const index = await (await fetch(`${url}/index.json`)).json();
  const ids = Object.entries(index.entries)
    .filter(([id, e]) => e.type === 'story' && id.includes(filter))
    .map(([id]) => id);
  const items = widths.flatMap((w) => ids.map((id) => ({ w, id })));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--force-color-profile=srgb'],
  });
  const pages = [];
  let n = 0;
  await runPool(items, concurrency, async ({ w, id }, wk) => {
    if (!pages[wk]) {
      const c = await browser.newContext({
        viewport: { width: w, height: 800 },
        reducedMotion: 'reduce',
        deviceScaleFactor: 1,
      });
      pages[wk] = await c.newPage();
    }
    const p = pages[wk];
    await p.setViewportSize({ width: w, height: 800 });
    try {
      const g = globals ? `&globals=${encodeURIComponent(globals)}` : '';
      await p.goto(`${url}/iframe.html?id=${id}&viewMode=story${g}`, {
        waitUntil: 'load',
        timeout: 20000,
      });
      await p.addStyleTag({
        content:
          '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}',
      });
      let size = -1;
      let still = 0;
      for (let i = 0; i < 40; i++) {
        await p.waitForTimeout(250);
        const c = await p.evaluate(() => document.querySelectorAll('#storybook-root *').length);
        if (c === size && c > 0) {
          if (++still >= 6) break; // 1.5 s without a DOM change: async data has landed
        } else still = 0;
        size = c;
      }
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(1200);
      await p.screenshot({ path: `${dir}/${id}@${w}.png`, fullPage: true });
    } catch (e) {
      fs.writeFileSync(`${dir}/${id}@${w}.err`, String(e).slice(0, 200));
    }
    if (++n % 100 === 0) console.log(`${n} / ${items.length}`);
  });
  await browser.close();
  console.log(`shot ${n} into ${dir}`);
}

async function raw(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

async function compare() {
  const files = fs.readdirSync(ref).filter((f) => f.endsWith('.png') && f.includes(filter));
  const diffs = [];
  let same = 0;
  for (const f of files) {
    if (!fs.existsSync(`${dir}/${f}`)) {
      diffs.push(`${f}: missing in ${dir}`);
      continue;
    }
    if (fs.readFileSync(`${ref}/${f}`).equals(fs.readFileSync(`${dir}/${f}`))) {
      same++;
      continue;
    }
    const [a, b] = await Promise.all([raw(`${ref}/${f}`), raw(`${dir}/${f}`)]);
    if (a.w !== b.w || a.h !== b.h) {
      diffs.push(`${f}: size ${a.w}x${a.h} -> ${b.w}x${b.h}`);
      continue;
    }
    let px = 0;
    for (let i = 0; i < a.data.length; i += 4)
      if (
        a.data[i] !== b.data[i] ||
        a.data[i + 1] !== b.data[i + 1] ||
        a.data[i + 2] !== b.data[i + 2] ||
        a.data[i + 3] !== b.data[i + 3]
      )
        px++;
    if (px) diffs.push(`${f}: ${px} px differ`);
    else same++;
  }
  console.log(`identical ${same}, different ${diffs.length}, of ${files.length}`);
  for (const d of diffs.slice(0, 80)) console.log(`  ${d}`);
  if (diffs.length) process.exit(1);
}

if (!flag('compare-only')) await shoot();
if (ref) await compare();
