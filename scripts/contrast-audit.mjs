#!/usr/bin/env node
/* global document, window -- the probe functions run inside the page */
/**
 * Contrast audit of every Storybook story, element by element (SPO-60): axe `color-contrast` (WCAG 2 AA: 4.5:1 text,
 * 3:1 large text) on the real rendering of each story, per look: theme x colour mode x accent (x the automatic night
 * dimming). Reports the element, the measured ratio, the colours and the story it lives in.
 *   npm run build-storybook && npx http-server client/storybook-static -p 6006 &
 *   node scripts/contrast-audit.mjs --themes studio --modes dark,light --accents brass,lime --filter kit- --out /tmp/c.json
 * options: --url --themes a,b --modes dark,light --accents x,y (default: the app's default accent) --sleep night
 *          (adds data-sleep=night on <html>) --filter <substring of story id> --part i/n --concurrency k --out file.json
 * Needs axe-core (devDependency). Exit code 1 when there are findings, so it can gate once the known ones are fixed.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import { parsePart, runPool, shard } from './lib/pool.mjs';

const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const url = arg('url', 'http://127.0.0.1:6006');
const themes = arg('themes', 'studio').split(',');
const modes = arg('modes', 'dark,light').split(',');
const accents = arg('accents', '').split(',');
const sleep = arg('sleep', '');
const filter = arg('filter', '');
const partSpec = parsePart(arg('part', '0/1'));
const concurrency = Number(arg('concurrency', '2'));
const out = arg('out', '');
/** --ids-file: a JSON array of story ids to re-check (the ones a previous --out report listed). */
const idsFile = arg('ids-file', '');

const index = await (await fetch(`${url}/index.json`)).json();
const only = idsFile ? new Set(JSON.parse(fs.readFileSync(idsFile, 'utf8'))) : null;
const ids = shard(
  Object.entries(index.entries)
    .filter(([id, e]) => e.type === 'story' && id.includes(filter) && (!only || only.has(id)))
    .map(([id]) => id),
  partSpec,
);
const looks = themes.flatMap((theme) =>
  modes.flatMap((mode) => accents.map((accent) => ({ theme, mode, accent }))),
);

const browser = await chromium.launch();
const ctxs = [];
const uses = [];
const report = [];
let probes = 0;

for (const look of looks) {
  const globals = [
    `theme:${look.theme}`,
    `mode:${look.mode}`,
    look.accent && `accent:${look.accent}`,
  ]
    .filter(Boolean)
    .join(';');
  await runPool(ids, concurrency, async (id, w) => {
    // a fresh page every 120 stories and after a crash: one long-lived page runs the renderer out of memory
    if (ctxs[w] && (uses[w] = (uses[w] ?? 0) + 1) > 120) {
      await ctxs[w].context().close();
      ctxs[w] = null;
    }
    if (!ctxs[w]) {
      uses[w] = 0;
      ctxs[w] = await (
        await browser.newContext({ viewport: { width: 390, height: 800 } })
      ).newPage();
    }
    const page = ctxs[w];
    try {
      await page.goto(`${url}/iframe.html?id=${id}&viewMode=story&globals=${globals}`, {
        waitUntil: 'load',
        timeout: 20000,
      });
      if (sleep)
        await page.evaluate((s) => document.documentElement.setAttribute('data-sleep', s), sleep);
      // Storybook paints the canvas a fixed dark #16171a (backgrounds addon): in the light mode that is not the app's page, so the real page colour goes back
      await page.evaluate(() => {
        document.body.style.setProperty('background', 'var(--color-bg)', 'important');
      });
      // long enough for the theme swap animation and colour transitions to finish: axe would measure a colour half-way
      await page.waitForTimeout(1300);
      await page.addScriptTag({ content: AXE });
      const nodes = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: ['color-contrast'] });
        // WCAG 1.4.3 exempts inactive controls: skip anything inside a disabled control or its group.
        const inactive = (n) =>
          Boolean(
            document
              .querySelector(n.target[n.target.length - 1])
              ?.closest('.is-disabled, [disabled], [aria-disabled="true"], :disabled'),
          );
        return r.violations.flatMap((v) =>
          v.nodes
            .filter((n) => !inactive(n))
            .map((n) => {
              const d = n.any[0]?.data ?? {};
              return {
                target: n.target.join(' '),
                ratio: d.contrastRatio,
                need: d.expectedContrastRatio,
                fg: d.fgColor,
                bg: d.bgColor,
                size: d.fontSize,
                text: (n.html.match(/>([^<]{1,40})</) ?? [])[1] ?? '',
              };
            }),
        );
      });
      probes++;
      for (const n of nodes) report.push({ id, ...look, ...n });
    } catch (e) {
      probes++;
      report.push({ id, ...look, target: 'error', text: String(e).slice(0, 80) });
      await ctxs[w]
        ?.context()
        .close()
        .catch(() => undefined);
      ctxs[w] = null;
    }
  });
}
await browser.close();
if (out) fs.writeFileSync(out, JSON.stringify({ probes, report }, null, 1));
const bad = report.filter((r) => r.target !== 'error');
console.log(
  `contrast: ${ids.length} stories x ${looks.length} looks: ${bad.length} low-contrast elements in ${new Set(bad.map((r) => r.id)).size} stories (${report.length - bad.length} errors)`,
);
process.exit(report.length ? 1 : 0);
