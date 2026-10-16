#!/usr/bin/env node
/* global document, getComputedStyle, innerWidth -- the probe function runs inside the page */
/**
 * Story geometry audit (SPO-103 / SPO-28 / SPO-113): opens every Storybook story in a real browser across locales,
 * phone widths and a large system font, and reports layout that breaks:
 *   page-hscroll    the page scrolls sideways (document wider than the viewport)
 *   drawer-overflow a drawer / dialog scrolls sideways or a child sticks out of it (outside a deliberate scroller)
 *   text-clipped    text cut off by overflow:hidden without an ellipsis or a line clamp (a label that does not fit)
 *   shadow-clipped  a box-shadow cut off by an ancestor with overflow (SPO-11: the edge of the shadow looks sawn off)
 * Exit code 1 when anything is found, so CI can gate on it.
 *
 *   npm run build-storybook && npx http-server client/storybook-static -p 6006 &
 *   npm run audit:stories -- --url http://127.0.0.1:6006 --locales en,uk,pl,lt,et --widths 320,360,390 --fonts 1,1.5
 *   options: --height <px> (viewport height; ~380 emulates an open on-screen keyboard) --filter <substring of story id> --part i/n (split the work) --out report.json
 */
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { parsePart, runPool, shard } from './lib/pool.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const url = arg('url', 'http://127.0.0.1:6006');
const locales = arg('locales', 'en,uk,pl,lt,et').split(',');
const widths = arg('widths', '320,360,390').split(',').map(Number);
const fonts = arg('fonts', '1').split(',').map(Number);
const filter = arg('filter', '');
const partSpec = parsePart(arg('part', '0/1'));
const concurrency = Number(arg('concurrency', '1'));
const out = arg('out', '');

const index = await (await fetch(`${url}/index.json`)).json();
const allIds = Object.entries(index.entries)
  .filter(([id, e]) => e.type === 'story' && id.includes(filter))
  .map(([id]) => id);
const ids = shard(allIds, partSpec);

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
      (cs.webkitLineClamp ?? 'none') === 'none' &&
      el.scrollWidth > el.clientWidth + 1 &&
      el.clientWidth > 1
    )
      found.push([
        'text-clipped',
        `${String(el.className).slice(0, 40)} "${el.textContent.trim().slice(0, 40)}"`,
      ]);
  }
  // A shadow reaches `blur + spread` beyond the box; an ancestor that clips (overflow) closer than that saws it off.
  const layers = (v) =>
    v === 'none'
      ? []
      : v
          .split(/,(?![^(]*\))/)
          .filter((l) => !/inset/.test(l))
          .map((l) =>
            (l.replace(/(rgba?|color)\([^)]*\)/g, '').match(/-?[\d.]+px/g) ?? []).map(parseFloat),
          )
          .filter((n) => n.length >= 3);
  const shadowSeen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.boxShadow === 'none' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const ext = { l: 0, r: 0, t: 0, b: 0 };
    for (const [ox, oy, blur, spread = 0] of layers(cs.boxShadow)) {
      const e = blur / 2 + spread; // the visible part of a blur is about half of it
      ext.l = Math.max(ext.l, e - ox);
      ext.r = Math.max(ext.r, e + ox);
      ext.t = Math.max(ext.t, e - oy);
      ext.b = Math.max(ext.b, e + oy);
    }
    // A hairline glow (<= 4px, e.g. the now-line) sitting flush against a scroll edge is not a visible defect.
    if (Math.max(ext.l, ext.r, ext.t, ext.b) <= 4) continue;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ac = getComputedStyle(a);
      const ar = a.getBoundingClientRect();
      const clipX = ac.overflowX !== 'visible';
      const clipY = ac.overflowY !== 'visible';
      const cut = [];
      if (clipX && r.left - ar.left >= -1 && r.left - ar.left < ext.l - 3) cut.push('left');
      if (clipX && ar.right - r.right >= -1 && ar.right - r.right < ext.r - 3) cut.push('right');
      if (clipY && r.top - ar.top >= -1 && r.top - ar.top < ext.t - 3) cut.push('top');
      if (clipY && ar.bottom - r.bottom >= -1 && ar.bottom - r.bottom < ext.b - 3)
        cut.push('bottom');
      if (cut.length) {
        const key = `${String(el.className).slice(0, 40)}>${String(a.className).slice(0, 30)}`;
        if (!shadowSeen.has(key)) {
          shadowSeen.add(key);
          found.push(['shadow-clipped', `${key} (${cut.join('+')})`]);
        }
        break;
      }
    }
  }
  return found.slice(0, 8);
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] }
    : {},
);
const report = [];
// One navigation per (width, locale, story); the font scales are applied to that same document one after another.
// The original flow also mounted the story at 1x and only then injected the scale, so the probes are the same.
const items = [];
for (const w of widths) for (const loc of locales) for (const id of ids) items.push({ w, loc, id });
const pages = [];
let probes = 0;
const setScale = (page, f) =>
  page.evaluate((scale) => {
    let el = document.getElementById('__audit_font');
    if (scale === 1) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement('style');
      el.id = '__audit_font';
      document.head.appendChild(el);
    }
    el.textContent = `html{font-size:${scale * 100}%}`;
  }, f);
await runPool(items, concurrency, async ({ w, loc, id }, worker) => {
  if (!pages[worker]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 800 },
      reducedMotion: 'reduce',
    });
    pages[worker] = await ctx.newPage();
  }
  const page = pages[worker];
  let loaded = false;
  try {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto(`${url}/iframe.html?id=${id}&viewMode=story&globals=locale:${loc}`, {
      waitUntil: 'load',
      timeout: 20000,
    });
    loaded = true;
  } catch (e) {
    for (const f of fonts) {
      probes++;
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
  if (!loaded) return;
  for (const f of fonts) {
    try {
      await setScale(page, f);
      await page.waitForTimeout(400);
      const found = await page.evaluate(probe);
      probes++;
      for (const [kind, detail] of found)
        report.push({ id, width: w, font: f, locale: loc, kind, detail });
    } catch (e) {
      probes++;
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
});
report.sort((x, y) =>
  `${x.id}|${x.locale}|${x.width}|${x.font}|${x.kind}|${x.detail}`.localeCompare(
    `${y.id}|${y.locale}|${y.width}|${y.font}|${y.kind}|${y.detail}`,
  ),
);
await browser.close();
if (out)
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        audit: 'stories',
        part: partSpec,
        total: allIds.length * locales.length * widths.length * fonts.length,
        expected: items.length * fonts.length,
        probes,
        report,
      },
      null,
      1,
    ),
  );
console.log(
  `audited ${ids.length} stories x ${locales.length} locales x ${widths.length} widths x ${fonts.length} font scales: ${report.length} findings`,
);
for (const r of report.slice(0, 40))
  console.log(`${r.kind}\t${r.id}\t${r.locale}\t${r.width}px\tx${r.font}\t${r.detail}`);
process.exit(report.length ? 1 : 0);
