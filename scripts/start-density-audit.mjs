#!/usr/bin/env node
/**
 * Start Drawer geometry guard (SPO-563 for SPO-561): on every phone size the drawer must fit its room with no
 * vertical scroll, no overlapping blocks, nothing clipped and everything clear of the × (the Start fab), in every
 * locale. Density is measured, not assumed: a tall phone must keep the full look (level <= --tall-max), the desktop
 * side panel must never get a density level.
 *   node scripts/start-density-audit.mjs --url http://127.0.0.1:6006 [--locales en,uk,pl,lt,et] [--part i/n] [--out report.json]
 */
/* global document, getComputedStyle */
import fs from 'node:fs';
import { chromium } from 'playwright';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg('url', 'http://127.0.0.1:6006');
const out = arg('out');
const locales = arg('locales', 'en,uk,pl,lt,et').split(',');
const themes = arg('themes', 'glass,cyberpunk,christmas,halloween').split(',');
const fonts = arg('fonts', '1,1.5').split(',').map(Number);
const [partI, partN] = arg('part', '1/1').split('/').map(Number);
const stories = [
  ['pages-start-sheet--drawer-open-fab', ''],
  ['pages-start-sheet--not-today', '&args=inline:!false'],
  ['pages-start-sheet--done-today', '&args=inline:!false'],
];
const sizes = [
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 700],
  [360, 740],
  [390, 844],
  [412, 915],
];
/** On a tall phone the full look (or one step) must be enough: tightening further would shrink things without need. */
const TALL = { minHeight: 900, maxLevel: 1 };

const jobs = [];
for (const s of stories) for (const z of sizes) jobs.push([s, z]);
const mine = jobs.filter((_, i) => i % partN === partI - 1);
const findings = [];
let probes = 0;

const browser = await chromium.launch();
try {
  for (const [[id, extra], [w, h]] of mine) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    for (const loc of locales) {
      await page.goto(`${url}/iframe.html?id=${id}&viewMode=story&globals=locale:${loc}${extra}`, {
        waitUntil: 'load',
      });
      await page.waitForTimeout(1200);
      for (const theme of themes) {
        for (const f of fonts) {
          await page.evaluate(
            ([t, scale]) => {
              document.documentElement.setAttribute('data-theme', t);
              let el = document.getElementById('__audit_font');
              if (!el) {
                el = document.createElement('style');
                el.id = '__audit_font';
                document.head.appendChild(el);
              }
              el.textContent = `html{font-size:${scale * 100}%}`;
            },
            [theme, f],
          );
          await page.waitForTimeout(300);
          probes++;
          const tag = `${id.split('--')[1]} ${w}x${h} ${loc} ${theme} x${f}`;
          const r = await page.evaluate(() => {
            const sh = document.querySelector('.sheet.start-sheet');
            if (!sh) return { none: true };
            const fab = document.querySelector('.tabbar-fab-layer .tabbar-fab, .tabbar-fab');
            const fabTop = fab ? fab.getBoundingClientRect().top : null;
            const kids = [
              ...sh.querySelectorAll('.ss-title,.ss-hero,.ss-another,.ss-scratch,.ss-tile,.notice'),
            ];
            let overlaps = 0;
            for (let i = 0; i < kids.length; i++)
              for (let j = i + 1; j < kids.length; j++) {
                const a = kids[i].getBoundingClientRect();
                const c = kids[j].getBoundingClientRect();
                if (
                  a.width &&
                  c.width &&
                  a.left < c.right - 1 &&
                  c.left < a.right - 1 &&
                  a.top < c.bottom - 1 &&
                  c.top < a.bottom - 1
                )
                  overlaps++;
              }
            const last = Math.max(...kids.map((k) => k.getBoundingClientRect().bottom));
            const clipped = kids.some(
              (k) =>
                k.scrollWidth > k.clientWidth + 1 && getComputedStyle(k).overflow !== 'visible',
            );
            // a one-word tile name must never break inside the word ("Program / s")
            const brokenWord = [...sh.querySelectorAll('.ss-tt')].some(
              (n) =>
                !/[\s-]/.test(n.textContent.trim()) &&
                n.getBoundingClientRect().height >
                  parseFloat(getComputedStyle(n).lineHeight || '0') * 1.5,
            );
            return {
              brokenWord,
              overflow: sh.scrollHeight - sh.clientHeight,
              overlaps,
              last: Math.round(last),
              fabTop: fabTop == null ? null : Math.round(fabTop),
              clipped,
              level: Number(sh.dataset.fit ?? 0),
            };
          });
          if (r.none) findings.push(`${tag}: no .start-sheet rendered`);
          else {
            if (r.overflow > 0)
              findings.push(`${tag}: drawer scrolls by ${r.overflow}px (level ${r.level})`);
            if (r.overlaps > 0)
              findings.push(`${tag}: ${r.overlaps} overlapping blocks (level ${r.level})`);
            if (r.fabTop != null && r.last > r.fabTop)
              findings.push(`${tag}: content ends ${r.last} under the × at ${r.fabTop}`);
            if (r.brokenWord)
              findings.push(`${tag}: a tile name breaks inside a word (level ${r.level})`);
            if (r.clipped) findings.push(`${tag}: a block is clipped sideways`);
            // done-today carries an extra hero row and the "another workout" card, so it legitimately needs more room.
            if (
              h >= TALL.minHeight &&
              f === 1 &&
              r.level > TALL.maxLevel &&
              !id.includes('done-today')
            )
              findings.push(
                `${tag}: tall phone tightened to level ${r.level} (> ${TALL.maxLevel}), the full look should stay`,
              );
          }
        }
      }
    }
    await ctx.close();
  }
  // The desktop side panel is never tightened.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  probes++;
  await page.goto(`${url}/iframe.html?id=pages-start-sheet--not-today&viewMode=story`, {
    waitUntil: 'load',
  });
  await page.waitForTimeout(1200);
  const dense = await page.evaluate(() => document.querySelectorAll('[data-fit]').length);
  if (partI === 1 && dense > 0)
    findings.push(`desktop 1280x800: ${dense} element(s) carry data-fit`);
  await ctx.close();
} finally {
  await browser.close();
}

if (out) fs.writeFileSync(out, JSON.stringify({ probes, findings }, null, 2));
console.log(`start-density audit: ${probes} probes, ${findings.length} findings`);
for (const f of findings.slice(0, 40)) console.log(` - ${f}`);
process.exit(findings.length ? 1 : 0);
