#!/usr/bin/env node
/* global document, getComputedStyle, innerWidth -- the probe function runs inside the page */
/**
 * Story geometry audit (SPO-103 / SPO-28 / SPO-113): opens every Storybook story in a real browser across locales,
 * phone widths and a large system font, and reports layout that breaks:
 *   page-hscroll    the page scrolls sideways (document wider than the viewport)
 *   drawer-overflow a drawer / dialog scrolls sideways or a child sticks out of it (outside a deliberate scroller)
 *   text-clipped    text cut off by overflow:hidden without an ellipsis (a label that does not fit its component)
 * Exit code 1 when anything is found, so CI can gate on it.
 *
 *   npm run build-storybook && npx http-server client/storybook-static -p 6006 &
 *   npm run audit:stories -- --url http://127.0.0.1:6006 --locales en,uk,pl,lt,et --widths 320,360,390 --fonts 1,1.5
 *   options: --filter <substring of story id> --part i/n (split the work) --out report.json
 */
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const url = arg('url', 'http://127.0.0.1:6006');
const locales = arg('locales', 'en,uk,pl,lt,et').split(',');
const widths = arg('widths', '320,360,390').split(',').map(Number);
const fonts = arg('fonts', '1').split(',').map(Number);
const filter = arg('filter', '');
const [part, parts] = arg('part', '0/1').split('/').map(Number);
const out = arg('out', '');

const index = await (await fetch(`${url}/index.json`)).json();
const ids = Object.entries(index.entries)
  .filter(([id, e]) => e.type === 'story' && id.includes(filter))
  .map(([id]) => id)
  .filter((_, i) => i % parts === part);

/** Runs in the page. */
const probe = () => {
  const found = [];
  const skip = /sr-only|visually-hidden|uistage-sr/;
  const inScroller = (el, stop) => {
    for (let p = el.parentElement; p && p !== stop; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true;
    }
    return false;
  };
  if (document.documentElement.scrollWidth > innerWidth + 1)
    found.push(['page-hscroll', `${document.documentElement.scrollWidth} > ${innerWidth}`]);
  for (const root of document.querySelectorAll('.sheet, .dialog, [role=dialog], .sdp, .uipanel')) {
    const rb = root.getBoundingClientRect();
    if (root.scrollWidth > root.clientWidth + 1)
      found.push([
        'drawer-overflow',
        `${root.className} ${root.scrollWidth} > ${root.clientWidth}`,
      ]);
    for (const el of root.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || (r.right <= rb.right + 1 && r.left >= rb.left - 1)) continue;
      if (getComputedStyle(el).position === 'fixed' || inScroller(el, root)) continue;
      found.push([
        'drawer-overflow',
        `${String(el.className).slice(0, 50)} out by ${Math.round(r.right - rb.right)}px`,
      ]);
      break;
    }
  }
  for (const el of document.querySelectorAll('body *')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1))
      continue;
    if (skip.test(String(el.className))) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (
      ['hidden', 'clip'].includes(cs.overflowX) &&
      cs.textOverflow !== 'ellipsis' &&
      el.scrollWidth > el.clientWidth + 1 &&
      el.clientWidth > 1
    )
      found.push([
        'text-clipped',
        `${String(el.className).slice(0, 40)} "${el.textContent.trim().slice(0, 40)}"`,
      ]);
  }
  return found.slice(0, 6);
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] }
    : {},
);
const report = [];
for (const w of widths) {
  for (const f of fonts) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 800 },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    for (const loc of locales) {
      for (const id of ids) {
        try {
          await page.goto(`${url}/iframe.html?id=${id}&viewMode=story&globals=locale:${loc}`, {
            waitUntil: 'load',
            timeout: 20000,
          });
          if (f !== 1) await page.addStyleTag({ content: `html{font-size:${f * 100}%}` });
          await page.waitForTimeout(400);
          const found = await page.evaluate(probe);
          for (const [kind, detail] of found)
            report.push({ id, width: w, font: f, locale: loc, kind, detail });
        } catch (e) {
          report.push({
            id,
            width: w,
            font: f,
            locale: loc,
            kind: 'error',
            detail: String(e).slice(0, 80),
          });
        }
      }
    }
    await ctx.close();
  }
}
await browser.close();
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log(
  `audited ${ids.length} stories x ${locales.length} locales x ${widths.length} widths x ${fonts.length} font scales: ${report.length} findings`,
);
for (const r of report.slice(0, 40))
  console.log(`${r.kind}\t${r.id}\t${r.locale}\t${r.width}px\tx${r.font}\t${r.detail}`);
process.exit(report.length ? 1 : 0);
