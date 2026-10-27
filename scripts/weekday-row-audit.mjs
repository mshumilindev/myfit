#!/usr/bin/env node
/* global document, getComputedStyle, innerWidth -- the probe functions run inside the page */
/**
 * Weekday row geometry audit (SPO-362 / SPO-363): every picker of the seven weekdays must stay ONE row of equal chips
 * on any width, in every theme and locale, and picking a day must not change a chip's width.
 *   not-7           the row does not hold seven chips
 *   wrapped         chips do not share one offsetTop (a chip fell onto a second row)
 *   outside         a chip sticks out of its group
 *   unequal         chip widths differ by more than 1 px (equal columns)
 *   width-on-toggle a chip's width changes when a day is picked / cleared
 *   small-target    a pressable chip is lower than 44 px
 *   text-clipped    a label is cut off (scrollWidth > clientWidth)
 *   page-hscroll    the page scrolls sideways
 * Exit code 1 when anything is found.
 *
 *   npm run build-storybook && npx http-server client/storybook-static -p 6006 &
 *   node scripts/weekday-row-audit.mjs --url http://127.0.0.1:6006 [--widths 320,360,390,768,1280] [--locales en,uk,pl,lt,et] [--themes glass,cyberpunk] [--fonts 1,2] [--out r.json]
 */
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { parsePart, runPool, shard } from './lib/pool.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const url = arg('url', 'http://127.0.0.1:6006');
const widths = arg('widths', '320,360,390,768,1280').split(',').map(Number);
const locales = arg('locales', 'en,uk,pl,lt,et').split(',');
const themes = arg('themes', 'glass,cyberpunk').split(',');
const fonts = arg('fonts', '1').split(',').map(Number);
const concurrency = Number(arg('concurrency', '2'));
const partSpec = parsePart(arg('part', '0/1'));
const out = arg('out', '');

/** Every weekday picker in the app: story id + the selector of its group (children = the seven chips). */
export const ROWS = [
  { id: 'tools-program-editor--self-host', group: '.pe-weekset', press: true },
  { id: 'tools-program-editor--self-host-sunday-start', group: '.pe-weekset', press: true },
  { id: 'kit-chip--weekday-grid', group: '[data-weekrow]', press: true },
  { id: 'kit-presetchips--grid', group: '.uipc--grid', press: true },
  { id: 'kit-presetchips--read-only', group: '.uipc--grid', press: false },
  { id: 'coach-weekday-toggle--interactive', group: '.uiwd', press: true },
  { id: 'coach-weekday-toggle--read-only', group: '.uiwd', press: false },
  { id: 'coach-weekday-toggle--phone', group: '.uiwd', press: true },
];

/** Runs in the page: measures every chip of every matching group. */
const measure = ({ group, press }) => {
  const res = [];
  const groups = [...document.querySelectorAll(group)];
  if (!groups.length) return [['no-group', group]];
  for (const g of groups) {
    const gr = g.getBoundingClientRect();
    const kids = [...g.children].filter((c) => getComputedStyle(c).display !== 'none');
    if (kids.length !== 7) res.push(['not-7', `${kids.length} chips`]);
    const rects = kids.map((k) => k.getBoundingClientRect());
    const tops = rects.map((r) => Math.round(r.top));
    if (Math.max(...tops) - Math.min(...tops) > 1) res.push(['wrapped', `tops ${tops.join(',')}`]);
    rects.forEach((r, i) => {
      if (r.left < gr.left - 1 || r.right > gr.right + 1)
        res.push([
          'outside',
          `chip ${i} ${Math.round(r.left)}..${Math.round(r.right)} in ${Math.round(gr.left)}..${Math.round(gr.right)}`,
        ]);
    });
    const ws = rects.map((r) => r.width);
    if (Math.max(...ws) - Math.min(...ws) > 1)
      res.push(['unequal', `widths ${ws.map((w) => w.toFixed(1)).join(',')}`]);
    if (press)
      rects.forEach((r, i) => {
        if (r.height < 43.5) res.push(['small-target', `chip ${i} ${r.height.toFixed(1)}px`]);
      });
    kids.forEach((k, i) => {
      const l = k.querySelector('.uichip-l, .uiwd-l') ?? k;
      if (l.scrollWidth > l.clientWidth + 1)
        res.push([
          'text-clipped',
          `chip ${i} "${l.textContent}" ${l.scrollWidth}>${l.clientWidth}`,
        ]);
    });
  }
  if (document.documentElement.scrollWidth > innerWidth + 1)
    res.push(['page-hscroll', `${document.documentElement.scrollWidth} > ${innerWidth}`]);
  return res;
};

/** Runs in the page: the width of every chip of the first group. */
const widthsOf = (group) =>
  [...document.querySelector(group).children].map((c) => c.getBoundingClientRect().width);

const browser = await chromium.launch();
const report = [];
let probes = 0;
const items = [];
for (const w of widths)
  for (const theme of themes)
    for (const loc of locales) for (const row of ROWS) items.push({ w, theme, loc, row });
const mine = shard(items, partSpec);
const pages = [];
await runPool(mine, concurrency, async ({ w, theme, loc, row }, worker) => {
  if (!pages[worker]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 900 },
      reducedMotion: 'reduce',
    });
    pages[worker] = await ctx.newPage();
  }
  const page = pages[worker];
  const tag = { id: row.id, width: w, theme, locale: loc };
  try {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(
      `${url}/iframe.html?id=${row.id}&viewMode=story&globals=locale:${loc};theme:${theme}`,
      {
        waitUntil: 'load',
        timeout: 30000,
      },
    );
    await page.waitForSelector(row.group, { timeout: 10000 });
    for (const f of fonts) {
      await page.evaluate((scale) => {
        document.documentElement.style.fontSize = scale === 1 ? '' : `${scale * 100}%`;
      }, f);
      await page.waitForTimeout(250);
      probes++;
      for (const [kind, detail] of await page.evaluate(measure, row))
        report.push({ ...tag, font: f, kind, detail });
      if (row.press) {
        const before = await page.evaluate(widthsOf, row.group);
        const btns = page.locator(`${row.group}:first-of-type > button:not([disabled])`);
        const n = await btns.count();
        for (let i = 0; i < Math.min(n, 3); i++) {
          await btns.nth(i).click();
          await page.waitForTimeout(120);
          const after = await page.evaluate(widthsOf, row.group);
          after.forEach((a, j) => {
            if (Math.abs(a - before[j]) > 0.5)
              report.push({
                ...tag,
                font: f,
                kind: 'width-on-toggle',
                detail: `chip ${j} ${before[j].toFixed(1)} -> ${a.toFixed(1)} after pick ${i}`,
              });
          });
        }
      }
    }
  } catch (e) {
    report.push({ ...tag, font: 1, kind: 'error', detail: String(e).slice(0, 120) });
  }
});
await browser.close();
report.sort((x, y) =>
  `${x.id}|${x.theme}|${x.locale}|${x.width}|${x.kind}`.localeCompare(
    `${y.id}|${y.theme}|${y.locale}|${y.width}|${y.kind}`,
  ),
);
if (out)
  fs.writeFileSync(
    out,
    JSON.stringify({ audit: 'weekday-rows', part: partSpec, probes, report }, null, 1),
  );
console.log(
  `audited ${ROWS.length} pickers x ${themes.length} themes x ${locales.length} locales x ${widths.length} widths x ${fonts.length} font scales: ${report.length} findings`,
);
const byKind = {};
for (const r of report) (byKind[`${r.kind}\t${r.id}`] ??= []).push(r);
for (const [k, v] of Object.entries(byKind))
  console.log(
    `${v.length}x\t${k}\te.g. ${v[0].width}px ${v[0].theme} ${v[0].locale}: ${v[0].detail}`,
  );
process.exit(report.length ? 1 : 0);
