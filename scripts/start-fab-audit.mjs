#!/usr/bin/env node
/**
 * Start fab guard (SPO-470): while the Start drawer is open the × must be (1) visible and the topmost element at its own
 * centre, (2) turned 135°, (3) able to close the drawer with one tap, (4) gone again afterwards with the real fab back.
 * Runs on both stories (drawer mounted before / after the twin — the lazy chunk case) in every theme.
 *   node scripts/start-fab-audit.mjs --url http://127.0.0.1:6006 [--out report.json]
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
const stories = [
  'pages-start-sheet--drawer-open-fab',
  'pages-start-sheet--drawer-open-fab-late-drawer',
];
const themes = ['glass', 'cyberpunk', 'christmas', 'halloween'];
const findings = [];
let probes = 0;

const browser = await chromium.launch();
try {
  for (const id of stories) {
    for (const theme of themes) {
      probes++;
      const tag = `${id.split('--')[1]} / ${theme}`;
      const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
      await page.goto(`${url}/iframe.html?id=${id}&viewMode=story`);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(1800);
      const r = await page.evaluate(() => {
        const f = document.querySelector('.tabbar-fab-layer .tabbar-fab');
        if (!f) return { err: 'no × button over the drawer' };
        const b = f.getBoundingClientRect();
        const x = b.left + b.width / 2;
        const y = b.top + b.height / 2;
        const el = document.elementFromPoint(x, y);
        const icon = f.querySelector('.ui-icon') ?? f;
        return {
          x,
          y,
          hit: !!el && !!el.closest('.tabbar-fab-layer'),
          sheet: !!document.querySelector('.sheet.start-sheet'),
          transform: getComputedStyle(icon).transform,
          realVisible: getComputedStyle(document.querySelector('.tabbar-wrap .tabbar-fab'))
            .visibility,
          label: f.getAttribute('aria-label'),
          expanded: f.getAttribute('aria-expanded'),
        };
      });
      if (r.err) findings.push(`${tag}: ${r.err}`);
      else {
        if (!r.sheet) findings.push(`${tag}: Start drawer is not open`);
        if (!r.hit) findings.push(`${tag}: × is covered (not topmost at its centre)`);
        // rotate(135deg) = matrix(cos, sin, -sin, cos) ≈ (-0.707, 0.707, -0.707, -0.707)
        const m = /matrix\(([^)]+)\)/.exec(r.transform ?? '');
        const v = m ? m[1].split(',').map(Number) : [];
        if (!(Math.abs(v[0] + 0.7071) < 0.02 && Math.abs(v[1] - 0.7071) < 0.02))
          findings.push(`${tag}: × is not turned 135° (${r.transform})`);
        if (r.realVisible !== 'visible')
          findings.push(`${tag}: bar button is hidden under the drawer (its ripple would vanish)`);
        if (r.expanded !== 'true') findings.push(`${tag}: aria-expanded is ${r.expanded}`);
        await page.mouse.click(r.x, r.y);
        await page.waitForTimeout(900);
        const after = await page.evaluate(() => ({
          sheet: !!document.querySelector('.sheet.start-sheet'),
          twin: !!document.querySelector('.tabbar-fab-layer'),
          real: getComputedStyle(document.querySelector('.tabbar-wrap .tabbar-fab')).visibility,
        }));
        if (after.sheet) findings.push(`${tag}: tap on × did not close the drawer`);
        if (after.twin) findings.push(`${tag}: × stayed after closing`);
        if (after.real !== 'visible') findings.push(`${tag}: real + button stayed hidden`);
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
console.log(`start-fab audit: ${probes} probes, 0 findings`);
