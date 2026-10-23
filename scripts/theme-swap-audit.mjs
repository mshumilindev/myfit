#!/usr/bin/env node
/* global document, getComputedStyle -- the page functions run inside the story iframe */
/**
 * Theme-swap audit (SPO-136, ADR 010): proves a re-theme is a token edit and nothing else.
 *
 * For every Storybook story: measure each visible element (radius, padding, gap, font family and
 * size), swap a hostile set of tokens on <html> (every --r-* radius, --s-* spacing,
 * --fs-* size, the font and the core surfaces), measure again, and list the elements whose value did
 * NOT move although it should have: a hard-coded radius, padding, font or colour that ignores the
 * tokens. Findings are (selector, property) pairs; the ones that exist today are frozen in
 * tests/theme-swap-baseline.json and may only SHRINK (a new pair is a finding, so CI fails).
 * Also writes before/after screenshots of a few stories (--shots) as the visual proof; pixel
 * comparison against a stored reference is SPO-59.
 *
 *   npm run build-storybook && npx http-server client/storybook-static -p 6006 &
 *   npm run audit:theme-swap -- --url http://127.0.0.1:6006 --part 0/1 --concurrency 5
 *   options: --filter <substring of story id> --out report.json --shots <dir> --shot-filter <regexp>
 *            --init (write the baseline from this run) / --write (lower it; never raises)
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { parsePart, runPool, shard } from './lib/pool.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const flag = (k) => process.argv.includes(`--${k}`);
const url = arg('url', 'http://127.0.0.1:6006');
const filter = arg('filter', '');
const partSpec = parsePart(arg('part', '0/1'));
const concurrency = Number(arg('concurrency', '1'));
const out = arg('out', '');
const shotsDir = arg('shots', '');
const shotFilter = new RegExp(arg('shot-filter', 'theme-swap--|pages-today'));
const BASELINE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'tests',
  'theme-swap-baseline.json',
);

const index = await (await fetch(`${url}/index.json`)).json();
const allIds = Object.entries(index.entries)
  .filter(([id, e]) => e.type === 'story' && id.includes(filter))
  .map(([id]) => id);
const ids = shard(allIds, partSpec);

/** Runs in the page: one record per visible element, in DOM order. */
const collect = (mark) => {
  const root = document.querySelector('#storybook-root') ?? document.body;
  const px = (v) => parseFloat(v) || 0;
  const all = mark ? [...root.querySelectorAll('*')] : [...root.querySelectorAll('[data-swap-i]')];
  return all.map((el, n) => {
    if (mark) el.dataset.swapI = String(n);
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const visible =
      r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
    const classes = [...el.classList].slice(0, 3).join('.');
    const radii = [
      cs.borderTopLeftRadius,
      cs.borderTopRightRadius,
      cs.borderBottomRightRadius,
      cs.borderBottomLeftRadius,
    ];
    return {
      i: Number(el.dataset.swapI),
      key: `${el.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`,
      visible,
      radius: radii.join(' '),
      circle: radii.some((v) => v.includes('%') || px(v) >= Math.min(r.width, r.height) / 2 - 0.5),
      padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '),
      gap: `${cs.rowGap} ${cs.columnGap}`,
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      background: cs.backgroundColor,
      text: [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0),
    };
  });
};

/** Runs in the page: swap the tokens on <html>. Returns how many it moved. */
const hostile = () => {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const names = new Set();
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules)
      if (rule.style) for (const n of rule.style) if (n.startsWith('--')) names.add(n);
  }
  let moved = 0;
  for (const n of names) {
    const raw = cs.getPropertyValue(n).trim();
    const m = raw.match(/^(-?[\d.]+)(px|rem)$/);
    let next = null;
    if (/^--r-/.test(n) && m && parseFloat(m[1]) > 0) next = `7${m[2]}`;
    else if (/^--s-\d/.test(n) && m && parseFloat(m[1]) > 0)
      next = `${parseFloat(m[1]) * 1.5 + 1}${m[2]}`;
    else if (/^--fs-/.test(n) && m) next = `${parseFloat(m[1]) * 1.25}${m[2]}`;
    else if (/^--font(-|$)/.test(n)) next = "Georgia, 'Times New Roman', serif";
    else if (n === '--color-bg') next = '#2b0a3d';
    else if (n === '--color-surface') next = '#3d0a2b';
    else if (n === '--color-surface-2') next = '#0a3d2b';
    if (next !== null) {
      root.style.setProperty(n, next);
      moved++;
    }
  }
  return moved;
};

const zero = (v) => v.split(' ').every((x) => x === '0px');
/** @returns {string[]} property names that stayed put although they should have moved */
function stuck(b, a) {
  const f = [];
  if (!b.visible) return f;
  if (!zero(b.radius) && !b.circle && a.radius === b.radius) f.push('radius');
  if (!zero(b.padding) && a.padding === b.padding) f.push('padding');
  if (!zero(b.gap.replace(/normal/g, '0px')) && a.gap === b.gap) f.push('gap');
  if (b.text && a.fontFamily === b.fontFamily) f.push('font-family');
  if (b.text && a.fontSize === b.fontSize) f.push('font-size');
  return f;
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] }
    : {},
);
const seen = new Set();
const errors = [];
let probes = 0;
const pages = [];
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
await runPool(ids, concurrency, async (id, worker) => {
  if (!pages[worker]) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 800 },
      reducedMotion: 'reduce',
    });
    pages[worker] = await ctx.newPage();
  }
  const page = pages[worker];
  probes++;
  try {
    let pairs = null;
    // Async stories can re-render mid-measurement: wait for a stable DOM, retry a few times.
    for (let attempt = 0; attempt < 3 && !pairs; attempt++) {
      await page.goto(`${url}/iframe.html?id=${id}&viewMode=story`, {
        waitUntil: 'load',
        timeout: 20000,
      });
      // Transitions/animations make computed values time-dependent (flaky pairs).
      await page.addStyleTag({
        content: '*,*::before,*::after{transition:none!important;animation:none!important}',
      });
      let size = -1;
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(300);
        const n = await page.evaluate(() => document.querySelectorAll('#storybook-root *').length);
        if (n === size && n > 0) break;
        size = n;
      }
      const before = await page.evaluate(collect, true);
      const shot = shotsDir && shotFilter.test(id);
      if (shot) await page.screenshot({ path: join(shotsDir, `${id}.before.png`) });
      const moved = await page.evaluate(hostile);
      await page.waitForTimeout(150);
      const after = await page.evaluate(collect);
      if (shot) await page.screenshot({ path: join(shotsDir, `${id}.after.png`) });
      if (moved === 0) throw new Error('hostile swap moved no token');
      // A swap can make responsive code add/remove nodes: compare only the ones present in both.
      const afterBy = new Map(after.map((a) => [a.i, a]));
      pairs = [];
      for (const b of before) {
        const a = afterBy.get(b.i);
        if (a) for (const prop of stuck(b, a)) pairs.push(`${b.key}|${prop}`);
      }
    }
    if (!pairs) throw new Error('DOM changed during the swap (3 attempts)');
    for (const pr of pairs) seen.add(pr);
  } catch (e) {
    errors.push({ id, kind: 'error', detail: String(e).slice(0, 120) });
  }
});
await browser.close();

const sorted = [...seen].sort();
if (flag('init') || flag('write')) {
  const prev = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')).pairs : [];
  if (partSpec.parts !== 1) {
    console.error('--init / --write need the whole matrix: run with --part 0/1');
    process.exit(2);
  }
  if (flag('write') && !flag('init')) {
    const fresh = sorted.filter((p) => !prev.includes(p));
    if (fresh.length) {
      console.error(
        `--write never raises the baseline; ${fresh.length} new pair(s):\n${fresh.join('\n')}`,
      );
      process.exit(1);
    }
  }
  fs.writeFileSync(BASELINE, JSON.stringify({ pairs: sorted }, null, 2) + '\n');
  console.log(
    `baseline written: ${sorted.length} (selector, property) pairs from ${ids.length} stories`,
  );
  process.exit(errors.length ? 1 : 0);
}

const base = new Set(JSON.parse(fs.readFileSync(BASELINE, 'utf8')).pairs);
const report = [
  ...errors,
  ...sorted
    .filter((p) => !base.has(p))
    .map((p) => ({
      kind: 'theme-swap',
      detail: `${p} ignores the tokens (hard-coded; use a token or add to the baseline knowingly)`,
    })),
];
const improved = [...base].filter((p) => !seen.has(p)).length;
if (out)
  fs.writeFileSync(
    out,
    JSON.stringify(
      { audit: 'swap', part: partSpec, total: allIds.length, expected: ids.length, probes, report },
      null,
      1,
    ),
  );
console.log(
  `theme-swap: ${ids.length} stories, ${sorted.length} frozen-or-new pairs, ${report.length} findings` +
    (partSpec.parts === 1 && improved
      ? `, ${improved} baseline pairs now fixed (run with --write)`
      : ''),
);
for (const r of report.slice(0, 40)) console.log(`${r.kind}\t${r.id ?? ''}\t${r.detail}`);
process.exit(report.length ? 1 : 0);
