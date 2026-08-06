/**
 * Verify an exercise with no logged sets renders the same table as any other
 * state: the ghost row spans the card and shares the header's columns.
 *
 * The regression this guards: the card also carried the shared `.empty-card`
 * class (a flex `align-items: flex-start` empty-state box), which shrank the
 * set list wrapper to its content width.
 *
 * Usage:
 *   npm run build -w client
 *   node scripts/verify-empty-exercise-card.mjs
 */
/* global document, getComputedStyle */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const DIST = join(process.cwd(), 'client/dist');
const TOLERANCE_PX = 1.5;

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
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = normalize(join(DIST, rel));
    if (!file.startsWith(DIST) || !existsSync(file)) {
      res.writeHead(404).end('not found');
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

async function findCss(base) {
  const html = await fetch(`${base}/`).then((r) => r.text());
  const m = html.match(/assets\/(index-[^"]+\.css)/);
  if (!m) throw new Error('css bundle not found in index.html');
  return m[1];
}

/** One strength card; `cardClass` is what SessionView puts on the wrapper. */
function card(cardClass, { sets, desktop }) {
  const typeCol = desktop ? '<span>TYPE</span><span></span>' : '<span></span>';
  const kindCell = desktop ? '<span class="kind">Working</span>' : '';
  const loggedRows = Array.from(
    { length: sets },
    (_, i) => `<button class="set-row">
        <span class="idx">${i + 1}</span><span class="val">12</span><span class="val">40</span>
        ${desktop ? '<span class="kind">Working</span><span class="cell5"></span>' : '<span class="kind"></span>'}
      </button>`,
  ).join('');
  return `<div class="${cardClass}">
    <div class="head"><span class="name">Cable Crunch</span></div>
    <div class="set-grid header"><span>#</span><span>REPS</span><span>KG</span>${typeCol}</div>
    <div>
      ${loggedRows}
      <div class="ghost-row">
        <span class="idx">${sets + 1}</span>
        <button class="gval">12</button>
        <button class="gval">40</button>
        ${kindCell}
        <button class="btn btn-primary log-btn">Log</button>
      </div>
    </div>
    <div class="ghost-hint">Tap a number to adjust it</div>
  </div>`;
}

function page(cssHref, cardClass, opts) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="${cssHref}"/>
</head><body>
<div id="root"><div class="app"><div class="main-col">
  <div class="screen session-live"><div class="session-body">
    ${card(cardClass, opts)}
  </div></div>
</div></div></div>
</body></html>`;
}

async function measure(p) {
  return p.evaluate(() => {
    const cardEl = document.querySelector('.exercise-card');
    const header = document.querySelector('.set-grid.header');
    const ghost = document.querySelector('.ghost-row');
    const row = document.querySelector('.set-row');
    if (!cardEl || !header || !ghost) return { error: 'missing card / header / ghost row' };
    const cs = getComputedStyle(cardEl);
    const inner =
      cardEl.getBoundingClientRect().width -
      parseFloat(cs.paddingLeft) -
      parseFloat(cs.paddingRight);
    const box = (el) => (el ? el.getBoundingClientRect() : null);
    return {
      cardInnerWidth: inner,
      header: box(header),
      ghost: box(ghost),
      row: box(row),
      headerCols: getComputedStyle(header).gridTemplateColumns,
      ghostCols: getComputedStyle(ghost).gridTemplateColumns,
      rowCols: row ? getComputedStyle(row).gridTemplateColumns : null,
    };
  });
}

function check(name, ok, detail) {
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  return ok ? 0 : 1;
}

async function inspect(browser, cssHref, cardClass, opts) {
  const context = await browser.newContext({
    viewport: opts.desktop ? { width: 1280, height: 900 } : { width: 390, height: 844 },
  });
  const p = await context.newPage();
  await p.setContent(page(cssHref, cardClass, opts), { waitUntil: 'load' });
  await p.waitForTimeout(60);
  const m = await measure(p);
  await context.close();
  return m;
}

function assertAligned(label, m) {
  let failed = 0;
  if (m.error) return check(label, false, m.error);
  const near = (a, b) => Math.abs(a - b) <= TOLERANCE_PX;
  failed += check(
    `${label}: ghost row fills the card`,
    near(m.ghost.width, m.cardInnerWidth),
    `ghost=${m.ghost.width.toFixed(1)} card=${m.cardInnerWidth.toFixed(1)}`,
  );
  failed += check(
    `${label}: ghost row aligns with header`,
    near(m.ghost.width, m.header.width) && near(m.ghost.left, m.header.left),
    `ghost=${m.ghost.left.toFixed(1)}+${m.ghost.width.toFixed(1)} header=${m.header.left.toFixed(1)}+${m.header.width.toFixed(1)}`,
  );
  failed += check(
    `${label}: ghost row uses the header columns`,
    m.ghostCols === m.headerCols,
    `${m.ghostCols} vs ${m.headerCols}`,
  );
  if (m.rowCols) {
    failed += check(
      `${label}: logged rows use the same columns`,
      m.rowCols === m.ghostCols,
      `${m.rowCols} vs ${m.ghostCols}`,
    );
  }
  return failed;
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('client/dist missing — run npm run build -w client first');
    process.exit(2);
  }
  const { server, base } = await startStaticServer();
  const cssHref = `${base}/assets/${await findCss(base)}`;
  const browser = await chromium.launch({ headless: true });

  let failed = 0;
  for (const desktop of [false, true]) {
    const width = desktop ? 'desktop' : 'mobile';
    const empty = await inspect(browser, cssHref, 'exercise-card active', { sets: 0, desktop });
    failed += assertAligned(`${width}, no sets`, empty);
    const filled = await inspect(browser, cssHref, 'exercise-card active', { sets: 2, desktop });
    failed += assertAligned(`${width}, 2 sets`, filled);
    if (!empty.error && !filled.error) {
      failed += check(
        `${width}: empty and filled cards render the same table`,
        Math.abs(empty.ghost.width - filled.ghost.width) <= TOLERANCE_PX &&
          empty.ghostCols === filled.ghostCols,
        `${empty.ghost.width.toFixed(1)} vs ${filled.ghost.width.toFixed(1)}`,
      );
    }
    // Negative control: the old markup (shared .empty-card box) must not pass.
    const regressed = await inspect(browser, cssHref, 'exercise-card active empty-card', {
      sets: 0,
      desktop,
    });
    const shrunk = !regressed.error && regressed.ghost.width < regressed.cardInnerWidth - 8;
    failed += check(
      `${width}: negative control — .empty-card markup still shrinks the row`,
      shrunk,
      regressed.error ?? `ghost=${regressed.ghost.width.toFixed(1)}`,
    );
  }

  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
