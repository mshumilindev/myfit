#!/usr/bin/env node
/* global document, window, getComputedStyle */
/**
 * Drawer stack guard (SPO-466 / SPO-467), on the real Today screen under 1, 2 and 3 stacked drawers, every theme, phone width:
 *  - exactly one scrim is drawn (the top one's) and it is the frosted pane (blur + tint);
 *  - everything on screen is either the top drawer or the scrim: the page and the lower drawers can be neither hit nor clicked;
 *  - a tap on the dimmed page closes ONLY the top drawer and is not delivered to the page;
 *  - Escape closes one drawer, not all;
 *  - the page and the lower drawers are inert (no keyboard way in);
 *  - a short drawer has no vertical scroll and no drawer scrolls sideways.
 *   node scripts/drawer-stack-audit.mjs --url http://127.0.0.1:6006 [--out report.json]
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg('url', 'http://127.0.0.1:6006');
const out = arg('out');
const stories = [
  ['pages-today--one-drawer', 1],
  ['pages-today--two-drawers', 2],
  ['pages-today--three-drawers', 3],
];
const themes = ['glass', 'cyberpunk', 'christmas', 'halloween'];
const findings = [];
let probes = 0;

const snap = () => ({
  sheets: document.querySelectorAll('.sheet:not(.sheet-closing)').length,
  drawn: Array.from(document.querySelectorAll('.scrim')).filter(
    (s) => !s.hasAttribute('data-covered') && Number(getComputedStyle(s).opacity) > 0.5,
  ).length,
  scrims: document.querySelectorAll('.scrim').length,
});

const browser = await chromium.launch();
try {
  for (const [id, depth] of stories) {
    for (const theme of themes) {
      probes++;
      const tag = `${id.split('--')[1]} / ${theme}`;
      const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
      await page.goto(`${url}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
      await page.waitForTimeout(1500);
      const a = await page.evaluate(snap);
      if (a.sheets !== depth) findings.push(`${tag}: ${a.sheets} drawers open, expected ${depth}`);
      if (a.drawn !== 1) findings.push(`${tag}: ${a.drawn} scrims are drawn, expected exactly 1`);
      const look = await page.evaluate(() => {
        const s = Array.from(document.querySelectorAll('.scrim')).find(
          (x) => !x.hasAttribute('data-covered'),
        );
        const c = getComputedStyle(s);
        return {
          blur: (c.backdropFilter || c.webkitBackdropFilter || '').includes('blur'),
          bg: c.backgroundColor,
        };
      });
      if (!look.blur) findings.push(`${tag}: the scrim has no blur (frosted pane)`);
      if (/rgba\(0, 0, 0, 0\)|transparent/.test(look.bg))
        findings.push(`${tag}: the scrim has no tint`);
      // everything on screen is the top drawer or the scrim
      const stray = await page.evaluate(() => {
        const sheets = Array.from(document.querySelectorAll('.sheet'));
        const top = sheets[sheets.length - 1];
        const bad = [];
        for (let y = 10; y < 790; y += 40)
          for (let x = 10; x < 390; x += 40) {
            const el = document.elementFromPoint(x, y);
            if (!el) continue;
            if (top.contains(el) || el.closest('.scrim')) continue;
            bad.push(`${x},${y} ${el.tagName}.${String(el.className).slice(0, 30)}`);
          }
        return bad.slice(0, 3);
      });
      if (stray.length)
        findings.push(`${tag}: reachable under the top drawer: ${stray.join(' | ')}`);
      // lower layers are inert
      const inert = await page.evaluate(() => {
        const layers = Array.from(document.querySelectorAll('.sheet')).map((s) =>
          s.closest('.portal-layer'),
        );
        return layers.map((l, i) => i === layers.length - 1 || l.hasAttribute('inert'));
      });
      if (inert.includes(false)) findings.push(`${tag}: a lower drawer is not inert`);
      // scroll rules
      const scroll = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.sheet')).map((s) => ({
          v: s.scrollHeight > s.clientHeight + 1,
          h: s.scrollWidth > s.clientWidth + 1,
        })),
      );
      if (scroll.some((s) => s.v)) findings.push(`${tag}: a short drawer scrolls vertically`);
      if (scroll.some((s) => s.h)) findings.push(`${tag}: a drawer scrolls sideways`);
      // a tap on the dimmed page: closes one drawer, reaches no page element
      await page.evaluate(() => {
        window.__pageClicks = 0;
        document.addEventListener(
          'click',
          (e) => {
            if (!e.target.closest('.portal-layer')) window.__pageClicks++;
          },
          true,
        );
      });
      await page.mouse.click(195, 60);
      await page.waitForTimeout(450);
      const after = await page.evaluate(snap);
      const clicks = await page.evaluate(() => window.__pageClicks);
      if (after.sheets !== depth - 1)
        findings.push(
          `${tag}: a tap on the page left ${after.sheets} drawers, expected ${depth - 1}`,
        );
      if (clicks) findings.push(`${tag}: the tap on the dimmed page was delivered to the page`);
      if (depth > 1) {
        if (after.drawn !== 1)
          findings.push(`${tag}: after one close ${after.drawn} scrims are drawn`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(450);
        const esc = await page.evaluate(snap);
        if (esc.sheets !== depth - 2)
          findings.push(`${tag}: Escape left ${esc.sheets} drawers, expected ${depth - 2}`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (out)
  fs.writeFileSync(
    out,
    JSON.stringify({ probes, expected: stories.length * themes.length, findings }, null, 2),
  );
if (findings.length) {
  findings.forEach((f) => console.error(`✗ ${f}`));
  process.exit(1);
}
console.log(`drawer-stack audit: ${probes} probes, 0 findings`);
