#!/usr/bin/env node
/* global document, getComputedStyle, innerWidth */
/**
 * Page hero / top bar spacing audit (SPO-96): on every page story with a back button, the bar that holds it must be one
 * clean row: back, title and actions on one axis, no overlap, equal room above and below, and its left / right edges on
 * the same lines as the content under it. Measures real geometry in Storybook.
 *
 *   npm run audit:hero -- --url http://127.0.0.1:6006 --widths 768,1024,1440,1920
 * Exit code 1 on any finding.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const url = arg('url', 'http://127.0.0.1:6006');
const widths = arg('widths', '390,768,1024,1440,1920').split(',').map(Number);
const filter = arg('filter', 'pages-');
const out = arg('out', '');

const probe = () => {
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    const c = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none';
  };
  const backs = [...document.querySelectorAll('.uiback, button.back')].filter(
    (b) => vis(b) && b.getBoundingClientRect().top < 220,
  );
  const res = [];
  for (const back of backs.slice(0, 1)) {
    const row = back.parentElement;
    const rr = row.getBoundingClientRect();
    const br = back.getBoundingClientRect();
    const kids = [...row.children].filter((k) => k !== back && vis(k));
    const title = kids.find((k) => /\S/.test(k.textContent)) ?? null;
    const f = [];
    if (title) {
      const tr = title.getBoundingClientRect();
      if (
        tr.left < br.right - 0.5 &&
        tr.right > br.left &&
        tr.top < br.bottom &&
        tr.bottom > br.top
      )
        f.push(['overlap', 'back and title overlap']);
      const dc = Math.abs(br.top + br.height / 2 - (tr.top + tr.height / 2));
      if (dc > 3) f.push(['axis', `back and title centres differ by ${Math.round(dc)}px`]);
    }
    const all = [back, ...kids].map((k) => k.getBoundingClientRect());
    const top = Math.min(...all.map((r) => r.top)) - rr.top;
    const bottom = rr.bottom - Math.max(...all.map((r) => r.bottom));
    const cs = getComputedStyle(row);
    const painted = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none';
    if (painted && Math.abs(top - bottom) > 3)
      f.push(['vgap', `room above ${Math.round(top)}px, below ${Math.round(bottom)}px`]);
    const next = row.nextElementSibling;
    if (next && vis(next)) {
      const nr = next.getBoundingClientRect();
      if (nr.width > 50 && (Math.abs(nr.left - rr.left) > 1 || Math.abs(nr.right - rr.right) > 1))
        f.push([
          'edges',
          `bar ${Math.round(rr.left)}-${Math.round(rr.right)}, content ${Math.round(nr.left)}-${Math.round(nr.right)}`,
        ]);
    }
    const left = br.left - rr.left;
    const right = rr.right - Math.max(...all.map((r) => r.right));
    if (painted && Math.abs(left - right) > 4 && kids.length)
      f.push(['hgap', `room left ${Math.round(left)}px, right ${Math.round(right)}px`]);
    if (document.documentElement.scrollWidth > innerWidth + 1)
      f.push(['hscroll', 'page scrolls sideways']);
    res.push(...f);
  }
  return { n: backs.length, res };
};

const idx = await (await fetch(`${url}/index.json`)).json();
const ids = Object.values(idx.entries)
  .filter((e) => e.type === 'story' && e.id.includes(filter))
  .map((e) => e.id);
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] }
    : {},
);
const report = [];
let probed = 0;
for (const w of widths) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  for (const id of ids) {
    try {
      await page.goto(`${url}/iframe.html?id=${id}&viewMode=story`, {
        waitUntil: 'load',
        timeout: 20000,
      });
      await page.waitForTimeout(350);
      const got = await page.evaluate(probe);
      probed += got.n ? 1 : 0;
      for (const [kind, detail] of got.res) report.push({ id, width: w, kind, detail });
    } catch (e) {
      report.push({ id, width: w, kind: 'error', detail: String(e).slice(0, 80) });
    }
  }
  await ctx.close();
}
await browser.close();
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log(
  `hero audit: ${ids.length} stories (${probed} with a back bar) x ${widths.length} widths: ${report.length} findings`,
);
for (const r of report.slice(0, 80)) console.log(`${r.kind}\t${r.id}\t${r.width}px\t${r.detail}`);
process.exit(report.length ? 1 : 0);
