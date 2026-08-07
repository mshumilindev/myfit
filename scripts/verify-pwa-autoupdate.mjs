/**
 * Verify a deploy reaches an already-open PWA.
 *
 * The bug this guards: an iOS home-screen app keeps the bundle it launched
 * with, so shipped fixes stayed invisible until the user killed the app twice.
 * Two mechanisms must work:
 *   1. public/sw-refresh.js — the replacing worker navigates open windows,
 *      which is the only thing that can rescue a page running an old bundle.
 *   2. src/pwaUpdate.ts — the page reloads itself when a new worker takes over.
 *
 * Usage:  npm run build -w client && node scripts/verify-pwa-autoupdate.mjs
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';

const DIST = join(process.cwd(), 'client/dist');
const STALE_PAGE = '/__stale.html';

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

function serve(root) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = normalize(join(root, rel));
    const target = file.startsWith(root) && existsSync(file) ? file : join(root, 'index.html');
    res.writeHead(200, {
      'content-type': mime[extname(target)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(readFileSync(target));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

/** Byte-change sw.js the way a real deploy does, so the browser installs it. */
function shipNewBuild(root, tag) {
  const sw = join(root, 'sw.js');
  writeFileSync(sw, `${readFileSync(sw, 'utf8')}\n// build ${tag}\n`);
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  if (!existsSync(join(DIST, 'sw.js'))) {
    console.error('client/dist/sw.js missing — run npm run build -w client first');
    process.exit(2);
  }

  const root = mkdtempSync(join(tmpdir(), 'spotter-pwa-'));
  cpSync(DIST, root, { recursive: true });
  // A page with no app JS: only the service worker can send it to a new build.
  writeFileSync(
    join(root, STALE_PAGE.slice(1)),
    '<!doctype html><title>stale</title><h1>stale</h1>',
  );

  const { server, base } = await serve(root);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  // The app itself talks to Firebase; keep the test offline of everything else.
  await context.route('**/*', (route) =>
    /googleapis|firebase|gstatic/.test(route.request().url()) ? route.abort() : route.continue(),
  );

  const app = await context.newPage();
  await app.goto(`${base}/`, { waitUntil: 'load' });
  const controlled = await app
    .waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  check('app page registers a service worker and gets controlled', controlled);
  if (!controlled) {
    await browser.close();
    server.close();
    process.exit(1);
  }

  // A second window, controlled but running no app code — stands in for the
  // suspended home-screen page that is stuck on yesterday's bundle.
  const stale = await context.newPage();
  await stale.goto(`${base}${STALE_PAGE}`, { waitUntil: 'load' });
  let staleNavigations = 0;
  stale.on('framenavigated', (f) => {
    if (f === stale.mainFrame()) staleNavigations++;
  });
  let appNavigations = 0;
  app.on('framenavigated', (f) => {
    if (f === app.mainFrame()) appNavigations++;
  });

  shipNewBuild(root, 2);
  await app.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg.update();
  });

  const waitFor = async (get, timeout = 20_000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      if (get() > 0) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  };

  const staleRefreshed = await waitFor(() => staleNavigations);
  check(
    'stale page (no app code) is sent to the new build by the worker',
    staleRefreshed,
    `navigations=${staleNavigations}`,
  );

  const appRefreshed = await waitFor(() => appNavigations, 5_000);
  check('page running the app also reloads', appRefreshed, `navigations=${appNavigations}`);

  // A worker that is not replacing anything must not bounce a fresh visitor.
  const firstVisit = await context.newPage();
  let firstVisitNavigations = 0;
  await firstVisit.goto(`${base}${STALE_PAGE}`, { waitUntil: 'load' });
  firstVisit.on('framenavigated', (f) => {
    if (f === firstVisit.mainFrame()) firstVisitNavigations++;
  });
  await firstVisit.waitForTimeout(3_000);
  check(
    'no reload loop once the new worker is in charge',
    firstVisitNavigations === 0,
    `navigations=${firstVisitNavigations}`,
  );

  await browser.close();
  server.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} FAIL` : '\nall checks OK');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
