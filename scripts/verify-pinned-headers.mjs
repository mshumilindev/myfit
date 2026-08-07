/**
 * Verify that on a phone every screen without the tab bar keeps its top block
 * — back button, session Finish — on screen while the content scrolls.
 *
 * Usage:  npm run build -w client && node scripts/verify-pinned-headers.mjs
 */
/* global document, window, getComputedStyle */
import { chromium, devices } from '@playwright/test';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const DIST = join(process.cwd(), 'client/dist');
const TOLERANCE_PX = 2;

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function startStaticServer() {
  const server = createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
    const file = normalize(join(DIST, rel === '/' ? '/index.html' : rel));
    const target = file.startsWith(DIST) && existsSync(file) ? file : join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': mime[extname(target)] || 'application/octet-stream' });
    res.end(readFileSync(target));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` }),
    );
  });
}

const rows = (n, cls = 'detail-card') =>
  Array.from({ length: n }, (_, i) => `<div class="${cls}">row ${i + 1}</div>`).join('');

/** Each case: the overlay screen markup and what must stay visible in it. */
const CASES = [
  {
    name: 'history / settings / exercise history (.hist-head)',
    pinned: '.hist-head',
    html: `<div class="screen hist-list">
      <div class="hist-head"><button class="back">B</button><h2 class="title-26">History</h2></div>
      ${rows(40)}
    </div>`,
  },
  {
    name: 'exercise library (.exlib-top)',
    pinned: '.exlib-top',
    html: `<div class="screen exlib">
      <div class="exlib-top"><button class="back">B</button><h2 class="title-26">Library</h2></div>
      ${rows(40)}
    </div>`,
  },
  {
    name: 'profile (.profile-top)',
    pinned: '.profile-top',
    html: `<div class="screen profile-page">
      <div class="profile-top"><button class="profile-back">B</button><div><div class="kicker">Profile</div><h2 class="title-26">Me</h2></div></div>
      ${rows(40)}
    </div>`,
  },
  {
    name: 'live session — hero with Finish (.session-top)',
    pinned: '.session-top',
    html: `<div class="screen paned session-screen session-live">
      <div class="pane-main">
        <div class="session-top live-toolbar">
          <div class="live-hero session-live-hero">
            <div class="live-hero-actions"><button class="btn btn-secondary">Finish</button></div>
          </div>
          <button class="back">B</button>
        </div>
        <div class="stats-strip"><div><div class="v">6</div></div></div>
        <div class="session-body">${rows(40, 'exercise-card')}</div>
      </div>
    </div>`,
  },
  {
    name: 'past session — back + delete row (.session-top)',
    pinned: '.session-top',
    html: `<div class="screen paned session-screen session-past">
      <div class="pane-main">
        <div class="session-top">
          <button class="back">B</button>
          <div class="mid"><div class="title">Friday</div></div>
          <button class="trash">T</button>
        </div>
        <div class="session-body">${rows(40, 'exercise-card')}</div>
      </div>
    </div>`,
  },
  {
    name: 'exercise detail — floating back over the video (.exd-back)',
    pinned: '.exd-back',
    fixed: true,
    html: `<div class="screen exd">
      <div class="exd-header">
        <div class="exd-video phone" style="height:220px"></div>
        <button class="exd-back">B</button>
      </div>
      <div class="exd-body">${rows(40)}</div>
    </div>`,
  },
  {
    name: 'gym detail — floating back over the photo (.hero-back)',
    pinned: '.hero-back',
    fixed: true,
    html: `<div class="gym-detail">
      <div class="gym-detail-hero"><button class="hero-back">B</button></div>
      <div class="gym-detail-body">${rows(40)}</div>
    </div>`,
  },
];

async function render(page, base, css, html, extraCss = '') {
  await page.setContent(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<link rel="stylesheet" href="${base}/assets/${css}"/>
<style>${extraCss}</style></head>
<body><div id="root"><div class="app"><div class="main-col">${html}</div></div></div></body></html>`,
    { waitUntil: 'load' },
  );
  await page.waitForTimeout(80);
}

/** Scroll whatever actually scrolls around the pinned element, then measure. */
async function scrollAndMeasure(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { error: `missing ${sel}` };
    const before = el.getBoundingClientRect();

    let scroller = el.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) {
      scroller = scroller.parentElement;
    }
    if (!scroller) return { error: `nothing scrolls around ${sel}` };
    scroller.scrollTop = scroller.scrollHeight;

    const after = el.getBoundingClientRect();
    return {
      scroller: scroller.className || scroller.tagName,
      scrolled: scroller.scrollTop,
      position: getComputedStyle(el).position,
      beforeTop: before.top,
      afterTop: after.top,
      afterBottom: after.bottom,
      viewportH: window.innerHeight,
    };
  }, selector);
}

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('client/dist missing — run npm run build -w client first');
    process.exit(2);
  }
  const { server, base } = await startStaticServer();
  const html = await fetch(`${base}/`).then((r) => r.text());
  const css = html.match(/assets\/(index-[^"]+\.css)/)?.[1];
  if (!css) throw new Error('css bundle not found in index.html');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 14 Pro'] });
  const page = await context.newPage();

  for (const c of CASES) {
    await render(page, base, css, c.html);
    const m = await scrollAndMeasure(page, c.pinned);
    if (m.error) {
      check(c.name, false, m.error);
      continue;
    }
    // Pinned means: the content scrolled a long way, the block did not move,
    // and it is still fully on screen.
    check(
      c.name,
      m.scrolled > 50 &&
        m.afterTop >= -TOLERANCE_PX &&
        m.afterBottom > 0 &&
        Math.abs(m.afterTop - m.beforeTop) <= TOLERANCE_PX,
      `position=${m.position} scrolled=${Math.round(m.scrolled)} top ${m.beforeTop.toFixed(0)}→${m.afterTop.toFixed(0)}`,
    );

    // Negative control: unpinned, the same block must leave the screen.
    await render(page, base, css, c.html, `${c.pinned}{position:static!important}`);
    const n = await scrollAndMeasure(page, c.pinned);
    check(
      `${c.name} — negative control scrolls away`,
      !n.error && n.afterBottom <= 0,
      n.error ?? `top ${n.beforeTop.toFixed(0)}→${n.afterTop.toFixed(0)}`,
    );
  }

  // Desktop must keep its own layout: no sticky headers there.
  const wide = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const widePage = await wide.newPage();
  await render(widePage, base, css, CASES[0].html);
  const desktopPosition = await widePage.evaluate(
    () => getComputedStyle(document.querySelector('.hist-head')).position,
  );
  check('desktop keeps headers in flow', desktopPosition === 'static', desktopPosition);

  await browser.close();
  server.close();
  console.log(failed ? `\n${failed} FAIL` : '\nall pinned headers OK');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
