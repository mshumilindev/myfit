#!/usr/bin/env node
/* global document, getComputedStyle, innerWidth, innerHeight -- the probe function runs inside the page */
/**
 * Story geometry audit (SPO-103 / SPO-28 / SPO-113): opens every Storybook story in a real browser across locales,
 * phone widths and a large system font, and reports layout that breaks:
 *   page-hscroll    the page scrolls sideways (document wider than the viewport)
 *   body-hscroll    <body> content is wider than the window although <html> hides it (overflow-x:hidden); known stories are listed in
 *                   scripts/story-audit-baseline.json (a ratchet: it only shrinks), a new one fails (SPO-144)
 *   drawer-overflow a drawer / dialog scrolls sideways or a child sticks out of it (outside a deliberate scroller)
 *   text-clipped    text cut off by overflow:hidden without an ellipsis or a line clamp (a label that does not fit)
 *   label-wrapped   a button / tab / chip / segmented label (--headings 1: also h1-h3) that falls onto a second line (SPO-62: translated
 *                   strings are longer; a label meant for one line must still fit on it)
 *   shadow-clipped  a box-shadow cut off by an ancestor with overflow (SPO-11: the edge of the shadow looks sawn off)
 *   row-off-centre  the Restless/OK/Good row is not on the centre axis of the screen's centred text (SPO-472/473)
 *   tile-clipped    a muscle-group tile whose muscle list is cut with an ellipsis, or whose TODAY tab is cut by an ancestor (SPO-485)
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
/** Extra Storybook globals, e.g. --globals "theme:studio;mode:light" (default: the app's default theme). */
const extraGlobals = arg('globals', '');
/** Headings wrap by nature (a long translated or user-written title); report them only on request: --headings 1. */
const withHeadings = arg('headings', '0') === '1';

/** Known body-hscroll stories (ratchet): `<story id>` → why. A story that no longer overflows must be removed from the file. */
const BASELINE = JSON.parse(
  fs.readFileSync(new URL('./story-audit-baseline.json', import.meta.url), 'utf8'),
);

const index = await (await fetch(`${url}/index.json`)).json();
const allIds = Object.entries(index.entries)
  .filter(([id, e]) => e.type === 'story' && id.includes(filter))
  .map(([id]) => id);
const ids = shard(allIds, partSpec);

/** Runs in the page. */
const probe = (withHeadings) => {
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
  // SPO-144: the app sets overflow-x:hidden on <html>, which pins documentElement.scrollWidth to the window, so content
  // wider than the screen only shows in <body>'s scrollWidth.
  else if (document.body.scrollWidth > innerWidth + 1)
    found.push(['body-hscroll', `body ${document.body.scrollWidth} > ${innerWidth}`]);
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
  // SPO-473: on the centred "Sleep logged" screen the quality row shares the centre axis with the title above it.
  for (const row of document.querySelectorAll('.sleep-screen .sleep-q-row .uiseg')) {
    const h = document.querySelector('.sleep-screen .sleep-h1');
    if (!h) continue;
    const a = row.getBoundingClientRect();
    const b = h.getBoundingClientRect();
    const off = Math.abs(a.left + a.width / 2 - (b.left + b.width / 2));
    if (off > 1)
      found.push(['row-off-centre', `quality row is ${Math.round(off)}px off the title axis`]);
  }
  // SPO-485: the muscle list in a group tile is content (it wraps, the tile grows); the TODAY tab sits above the tile's edge.
  for (const el of document.querySelectorAll('.xp-fam .xp-fam-subs')) {
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      found.push(['tile-clipped', `muscle list "${el.textContent.trim().slice(0, 40)}" is cut`]);
  }
  for (const el of document.querySelectorAll('.xp-fam .xp-today')) {
    const r = el.getBoundingClientRect();
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ac = getComputedStyle(a);
      if (ac.overflowY === 'visible' && ac.overflowX === 'visible') continue;
      const ar = a.getBoundingClientRect();
      if (r.top < ar.top - 1 || r.left < ar.left - 1 || r.right > ar.right + 1) {
        found.push(['tile-clipped', `TODAY tab cut by .${String(a.className).slice(0, 30)}`]);
        break;
      }
    }
  }
  const LABELS =
    '.uibtn:not(.uibtn--link) .uibtn-label, .uichip-l, .uiseg-l, [role=tab]:not(.uicard), .tabbar button > span:not(.tabbar-ico)';
  // Labels meant for one line. A deliberate wrap (a link, a multi-line option) is marked data-wrap on the element or its ancestor.
  const ONE_LINE = withHeadings ? `${LABELS}, h1, h2, h3` : LABELS;
  for (const el of document.querySelectorAll(ONE_LINE)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[data-wrap]')) continue;
    if (skip.test(String(el.className))) continue;
    // Only text counts (an icon or badge next to it sits at its own height). Each element that owns text is measured on its
    // own: two stacked spans (a date over "This week") are two deliberate lines, a label that breaks inside one is a defect.
    let lines = 1;
    for (const owner of [el, ...el.querySelectorAll('*')]) {
      const rects = [];
      for (const n of owner.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) rects.push(r);
      }
      rects.sort((x, y) => x.top - y.top);
      // A line's rect can be taller than the line pitch (tight line-height), so compare vertical centres, not edges.
      let count = 0;
      let centre = -Infinity;
      for (const r of rects) {
        const c = r.top + r.height / 2;
        if (c - centre > r.height * 0.6) count += 1;
        centre = c;
      }
      lines = Math.max(lines, count);
    }
    const tops = { size: lines };
    if (tops.size > 1)
      found.push([
        'label-wrapped',
        `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} "${el.textContent.trim().slice(0, 40)}" on ${tops.size} lines`,
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
    // Parked outside the window (a skip link until it takes focus) shows nothing, so its shadow cannot be a defect.
    if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) continue;
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
      // An element that fills its clipping ancestor edge to edge (a card laid over a photo hero) is meant to be clipped by it; nothing further out can see the shadow.
      if (
        (clipX || clipY) &&
        Math.abs(r.left - ar.left) <= 1 &&
        Math.abs(ar.right - r.right) <= 1 &&
        Math.abs(r.top - ar.top) <= 1 &&
        Math.abs(ar.bottom - r.bottom) <= 1
      )
        break;
      const cut = [];
      // A clip edge that is the window edge hides nothing the user could see beyond it.
      const atWin = (v, edge) => Math.abs(v - edge) <= 1;
      if (clipX && !atWin(ar.left, 0) && r.left - ar.left >= -1 && r.left - ar.left < ext.l - 3)
        cut.push('left');
      if (
        clipX &&
        !atWin(ar.right, innerWidth) &&
        ar.right - r.right >= -1 &&
        ar.right - r.right < ext.r - 3
      )
        cut.push('right');
      if (clipY && !atWin(ar.top, 0) && r.top - ar.top >= -1 && r.top - ar.top < ext.t - 3)
        cut.push('top');
      if (
        clipY &&
        !atWin(ar.bottom, innerHeight) &&
        ar.bottom - r.bottom >= -1 &&
        ar.bottom - r.bottom < ext.b - 3 &&
        // Still scrollable downwards and padded below the content by at least the glow: the shadow is only
        // cut by the window of the scroller until it is scrolled, and the padding leaves it room at the end.
        !(
          a.scrollTop + a.clientHeight < a.scrollHeight - 1 &&
          parseFloat(ac.paddingBottom) >= ext.b - 3
        )
      )
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
    await page.goto(
      `${url}/iframe.html?id=${id}&viewMode=story&globals=locale:${loc}${extraGlobals ? ';' + extraGlobals : ''}`,
      {
        waitUntil: 'load',
        timeout: 20000,
      },
    );
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
      const found = await page.evaluate(probe, withHeadings);
      probes++;
      for (const [kind, detail] of found) {
        if (kind === 'body-hscroll' && BASELINE.bodyHscroll?.[id]) continue;
        report.push({ id, width: w, font: f, locale: loc, kind, detail });
      }
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
