#!/usr/bin/env node
/* global document -- the probe functions run inside the page */
/**
 * Weekday row audit (SPO-362): every group of seven day chips (ChipGroup grid, coach WeekdayToggle) sits in ONE row of
 * equal-width columns, is not wider than the viewport, clips no text and keeps a 44 px touch height, at 320-1440 px, in
 * all five locales, both themes and at a 1.5x font. Picking days must not change a chip's width.
 *   npx http-server client/storybook-static -p 6006 &
 *   node scripts/weekday-row-audit.mjs [http://127.0.0.1:6006]
 * Exit code 1 on any finding, so CI can gate on it.
 */
import { chromium } from '@playwright/test';
const BASE = process.argv[2] ?? 'http://127.0.0.1:6006';
const stories = [
  'kit-chip--weekday-grid',
  'coach-weekday-toggle--phone',
  'coach-weekday-toggle--interactive',
  'coach-weekday-toggle--read-only',
];
const widths = [320, 390, 1440],
  locales = ['en', 'uk', 'pl', 'lt', 'et'],
  fonts = [1, 1.5];
const themes = ['glass', 'cyberpunk'];
const b = await chromium.launch();
const bad = [];
let groups = 0;
for (const w of widths) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  for (const th of themes)
    for (const loc of locales)
      for (const id of stories) {
        await page.goto(
          `${BASE}/iframe.html?id=${id}&viewMode=story&globals=locale:${loc};theme:${th}`,
          { waitUntil: 'networkidle' },
        );
        await page.waitForTimeout(300);
        for (const f of fonts) {
          await page.evaluate((f) => {
            document.documentElement.style.fontSize = 16 * f + 'px';
          }, f);
          await page.waitForTimeout(100);
          const res = await page.evaluate(() => {
            const out = [];
            const seen = new Set();
            for (const el of document.querySelectorAll('*')) {
              const kids = [...el.children].filter((c) =>
                c.matches('button,[role=button],label,[aria-pressed]'),
              );
              if (kids.length !== 7 || seen.has(el)) continue;
              seen.add(el);
              const rs = kids.map((k) => k.getBoundingClientRect());
              const tops = new Set(rs.map((r) => Math.round(r.top)));
              const ws = rs.map((r) => r.width),
                hs = rs.map((r) => r.height);
              const before = ws.map((x) => Math.round(x * 10) / 10);
              out.push({
                rows: tops.size,
                minW: Math.min(...ws),
                maxW: Math.max(...ws),
                minH: Math.min(...hs),
                right: Math.max(...rs.map((r) => r.right)),
                clipped: kids.some((k) => k.scrollWidth > k.clientWidth + 1),
                before,
                pressable: kids.filter((k) => k.hasAttribute('aria-pressed')).length,
              });
            }
            return out;
          });
          for (const g of res) {
            groups++;
            if (
              g.rows !== 1 ||
              g.maxW - g.minW > 1 ||
              g.right > w + 0.5 ||
              g.clipped ||
              g.minH < 44
            )
              bad.push({ w, th, loc, id, f, ...g });
          }
        }
      }
  await ctx.close();
}
// selection stability on the interactive story at 320/1.5 en
const ctx = await b.newContext({ viewport: { width: 320, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/iframe.html?id=kit-chip--weekday-grid&viewMode=story&globals=locale:en`, {
  waitUntil: 'networkidle',
});
const btns = page.locator('button[aria-pressed]');
const n = await btns.count();
const w0 = await btns.evaluateAll((a) => a.map((x) => x.getBoundingClientRect().width));
for (let i = 0; i < Math.min(n, 7); i++) await btns.nth(i).click();
const w1 = await btns.evaluateAll((a) => a.map((x) => x.getBoundingClientRect().width));
const drift = Math.max(...w0.map((x, i) => Math.abs(x - w1[i])));
console.log(
  `weekday rows: ${groups} groups checked, ${bad.length} findings, width drift on select ${drift}px`,
);
for (const x of bad.slice(0, 20)) console.log(JSON.stringify(x));
await b.close();
process.exit(bad.length > 0 || drift > 0.5 || groups < 20 ? 1 : 0);
