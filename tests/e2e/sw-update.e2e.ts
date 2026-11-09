/**
 * SPO-63: a new service worker takes over a running app without losing what the person logged.
 * The built client is served through a tiny proxy that can change the bytes of `/sw.js` (a new deploy); the page asks the
 * browser to look for an update, the replacement worker takes control, and the logged session is still there, also after a reload.
 *
 * Needs a built client on E2E_BASE_URL (default http://127.0.0.1:4173).
 * Run: `npx playwright test tests/e2e/sw-update.e2e.ts --project=mobile-chromium`.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import {
  arm,
  logPastSession,
  passProfileGate,
  showLoggedWeek,
  type Stub,
} from './helpers/layout-shift';

const ORIGIN = process.env.E2E_TODAY_URL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const CONSENT_VERIFIED = JSON.stringify({
  'e2e-m': 'terms@2026-10-21,policy-ack@2026-11-05,age-18@2026-10-21',
});

/** Forwards everything to the built client; `/sw.js` gets a trailing comment once `deploy()` has been called. */
async function startProxy(): Promise<{ url: string; deploy: () => void; server: Server }> {
  let deployed = false;
  const server = createServer((req, res) => {
    void (async () => {
      const up = await fetch(new URL(req.url ?? '/', ORIGIN));
      const headers: Record<string, string> = {};
      up.headers.forEach((v, k) => {
        if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k))
          headers[k] = v;
      });
      let body: Buffer = Buffer.from(await up.arrayBuffer());
      if ((req.url ?? '').split('?')[0] === '/sw.js' && deployed)
        body = Buffer.concat([body, Buffer.from('\n// e2e: a new deploy\n')]);
      res.writeHead(up.status, headers);
      res.end(body);
    })().catch(() => {
      res.writeHead(502);
      res.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    deploy: () => {
      deployed = true;
    },
    server,
  };
}

test('a new service worker takes over without losing the logged session', async ({ page }) => {
  test.setTimeout(90_000);
  const proxy = await startProxy();
  try {
    const BASE = proxy.url;
    await arm(page, { delayMs: 0, assignment: false } satisfies Stub, BASE, 'en');
    await page.addInitScript(
      (v) => localStorage.setItem('spotter.consentVerified', v),
      CONSENT_VERIFIED,
    );
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(BASE + '/');
    await passProfileGate(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
        timeout: 15_000,
      })
      .toBe(true);
    await page.waitForTimeout(3_000);
    await passProfileGate(page);

    await logPastSession(page);
    await page.evaluate(() => {
      window.location.hash = '#/history';
    });
    await showLoggedWeek(page);
    await expect(page.getByText(/1 sets/)).toHaveCount(1, { timeout: 15_000 });

    // a deploy happens: the browser finds different bytes at /sw.js and the replacement takes control
    await page.evaluate(() => {
      (window as unknown as { __swTaken: boolean }).__swTaken = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        (window as unknown as { __swTaken: boolean }).__swTaken = true;
      });
    });
    proxy.deploy();
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    });
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __swTaken: boolean }).__swTaken), {
        timeout: 30_000,
      })
      .toBe(true);

    // the running page keeps its data and stays calm; after a reload on the new worker the session is still there
    await expect(page.getByText(/1 sets/)).toHaveCount(1);
    await expect(page.locator('[role="alert"]')).toHaveCount(0);
    await page.reload();
    await passProfileGate(page);
    await page.evaluate(() => {
      window.location.hash = '#/history';
    });
    await showLoggedWeek(page);
    await expect(page.getByText(/1 sets/)).toHaveCount(1, { timeout: 20_000 });
    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  } finally {
    proxy.server.close();
  }
});
