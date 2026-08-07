/**
 * Verify hub tabbar sits flush to the screen bottom with ONLY the OS
 * safe-area as padding under the icons — no dead band, no 22px+safe double count.
 *
 * Usage:
 *   npx serve client/dist -l 4177 &
 *   BASE=http://127.0.0.1:4177 node scripts/verify-tabbar-safe-area.mjs
 */
/* global document, window, getComputedStyle */
import { chromium, devices } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const DIST = join(process.cwd(), 'client/dist');
const SAFE_BOTTOM = 34;
// Tab bar trims the safe-area inset (dead-band under labels felt too tall).
const EXPECTED_PAD = Math.max(8, SAFE_BOTTOM - 16);
const SAFE_TOP = 59;
const TOLERANCE_PX = 3;

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function startStaticServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = normalize(join(DIST, rel));
    if (!file.startsWith(DIST) || !existsSync(file)) {
      // SPA fallback
      const index = join(DIST, 'index.html');
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(readFileSync(index));
      return;
    }
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const tabbar = document.querySelector('.tabbar');
    const app = document.querySelector('.app');
    const root = document.getElementById('root');
    if (!tabbar || !app || !root) {
      return { error: 'missing .tabbar / .app / #root' };
    }
    const btn = tabbar.querySelector('button');
    const label = btn?.querySelector('span');
    const icon =
      btn?.querySelector('i, .ui-icon, svg')?.closest('i, .ui-icon') || btn?.querySelector('svg');
    const tb = tabbar.getBoundingClientRect();
    const appBox = app.getBoundingClientRect();
    const rootBox = root.getBoundingClientRect();
    const labelBox = label?.getBoundingClientRect();
    const iconBox = icon?.getBoundingClientRect();
    const cs = getComputedStyle(tabbar);
    const rootCs = getComputedStyle(document.documentElement);
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      root: { top: rootBox.top, bottom: rootBox.bottom, height: rootBox.height },
      app: { top: appBox.top, bottom: appBox.bottom, height: appBox.height },
      tabbar: {
        top: tb.top,
        bottom: tb.bottom,
        height: tb.height,
        paddingBottom: cs.paddingBottom,
        paddingTop: cs.paddingTop,
      },
      label: labelBox
        ? { bottom: labelBox.bottom, gapToViewport: window.innerHeight - labelBox.bottom }
        : null,
      icon: iconBox
        ? { bottom: iconBox.bottom, gapToViewport: window.innerHeight - iconBox.bottom }
        : null,
      cssSafeBottom: rootCs.getPropertyValue('--safe-bottom').trim(),
      gapTabbarToViewport: window.innerHeight - tb.bottom,
      gapRootToViewport: window.innerHeight - rootBox.bottom,
    };
  });
}

function assertClose(name, actual, expected, tol = TOLERANCE_PX) {
  const ok = Math.abs(actual - expected) <= tol;
  console.log(
    `${ok ? 'OK' : 'FAIL'}  ${name}: actual=${actual.toFixed?.(1) ?? actual} expected≈${expected} (±${tol})`,
  );
  return ok;
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('client/dist missing — run npm run build -w client first');
    process.exit(2);
  }

  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 14 Pro'],
  });
  const page = await context.newPage();

  // Chromium: override safe-area insets (what iOS PWA reports for home indicator).
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: SAFE_TOP, left: 0, right: 0, bottom: SAFE_BOTTOM },
    });
  } catch (err) {
    console.warn('setSafeAreaInsetsOverride unavailable, injecting CSS vars instead:', err.message);
    await page.addInitScript(
      ([top, bottom]) => {
        const s = document.createElement('style');
        s.textContent = `:root{--safe-top:${top}px!important;--safe-bottom:${bottom}px!important}`;
        document.documentElement.appendChild(s);
      },
      [SAFE_TOP, SAFE_BOTTOM],
    );
  }

  // Minimal shell so .tabbar exists without Firebase auth.
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('googleapis') || url.includes('firebase') || url.includes('gstatic')) {
      return route.abort();
    }
    return route.continue();
  });

  await page.setContent(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<link rel="stylesheet" href="${base}/assets/${await findCss(base)}"/>
<style>
  /* Ensure vars win even if CDP insets don't propagate to env() */
  :root {
    --safe-top: ${SAFE_TOP}px;
    --safe-bottom: ${SAFE_BOTTOM}px;
  }
</style>
</head>
<body>
<div id="root">
  <div class="app">
    <div class="main-col">
      <div class="screen"><h1>Today</h1><p>Verify tabbar safe-area.</p></div>
      <nav class="tabbar">
        <button class="active" type="button"><i class="ui-icon" style="width:20px;height:20px;background:#d9a24f;border-radius:2px"></i><span>Today</span></button>
        <button type="button"><i class="ui-icon" style="width:20px;height:20px;background:#71767b;border-radius:2px"></i><span>Progress</span></button>
        <button type="button"><i class="ui-icon" style="width:20px;height:20px;background:#71767b;border-radius:2px"></i><span>Gyms</span></button>
        <button type="button"><i class="ui-icon" style="width:20px;height:20px;background:#71767b;border-radius:2px"></i><span>Me</span></button>
      </nav>
    </div>
  </div>
</div>
</body>
</html>`,
    { waitUntil: 'load' },
  );

  // Wait a tick for layout
  await page.waitForTimeout(100);
  const m = await measure(page);
  console.log(JSON.stringify(m, null, 2));

  let failed = 0;
  if (m.error) {
    console.error('FAIL', m.error);
    failed++;
  } else {
    // Root fills viewport — no dead band under the app shell
    if (!assertClose('root fills viewport height', m.root.height, m.viewport.h)) failed++;
    if (!assertClose('no gap under #root', m.gapRootToViewport, 0)) failed++;
    if (!assertClose('no gap under .tabbar box', m.gapTabbarToViewport, 0)) failed++;
    // Padding under labels === safe-area only (not 22+34)
    const padBottom = parseFloat(m.tabbar.paddingBottom);
    if (!assertClose('tabbar padding-bottom == trimmed safe-area', padBottom, EXPECTED_PAD))
      failed++;
    // Labels sit above button padding (6px) + safe-area. Old bug was
    // padding-bottom = 22+safe (~56) → label gap ≈ 62+ and tabbar ≈ 110+.
    const buttonPad = 6;
    const expectedLabelGap = EXPECTED_PAD + buttonPad;
    if (m.label) {
      if (
        !assertClose('label→bottom gap == safe + btn pad', m.label.gapToViewport, expectedLabelGap)
      )
        failed++;
      if (m.label.gapToViewport >= SAFE_BOTTOM + 22 + buttonPad - 1) {
        console.log(
          `FAIL  label gap ${m.label.gapToViewport} looks like 22px+safe-area double-count`,
        );
        failed++;
      }
    } else {
      console.log('FAIL  no label box');
      failed++;
    }
    // Tabbar total ≈ 8 + ~48 content + safe (≈90). Double-count was ≈110+.
    if (m.tabbar.height > SAFE_BOTTOM + 70) {
      console.log(`FAIL  tabbar too tall: ${m.tabbar.height} (suspected double inset)`);
      failed++;
    } else {
      console.log(`OK  tabbar height ${m.tabbar.height.toFixed(1)} within budget`);
    }
    // Hard reject the previous live formula max(22px, safe) when safe is large
    // is OK; reject calc(22px + safe) which this padding must never equal.
    if (padBottom >= SAFE_BOTTOM + 20) {
      console.log(`FAIL  padding-bottom ${padBottom} includes extra ~22px`);
      failed++;
    }
  }

  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
}

async function findCss(base) {
  const html = await fetch(`${base}/`).then((r) => r.text());
  const m = html.match(/assets\/(index-[^"]+\.css)/);
  if (!m) throw new Error('css bundle not found in index.html');
  return m[1];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
