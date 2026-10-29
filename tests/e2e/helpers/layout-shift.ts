import { type BrowserContext, type Page, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

export const URL_ENV = process.env.E2E_TODAY_URL;
const ROOT = path.resolve(__dirname, '../../..');
/** Max CLS accepted (AC of SPO-102). */
export const CLS_BUDGET = 0.05;
/** When the stubbed `programMine` callable answers (after the first paint, like the real network read). */
export const ASSIGNMENT_DELAY_MS = 1200;

export interface Harness {
  base: string;
  start(): Promise<void>;
  stop(): void;
}

/** `vite preview` over a production build (E2E_TODAY_URL reuses a running server, E2E_TODAY_DIST picks the outDir). */
export function makeHarness(port: number): Harness {
  const base = URL_ENV ?? `http://127.0.0.1:${port}`;
  let server: ChildProcess | undefined;
  const waitForServer = async (): Promise<void> => {
    const started = Date.now();
    while (Date.now() - started < 20_000) {
      try {
        if ((await fetch(base)).ok) return;
      } catch {
        // keep polling
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`no server at ${base}`);
  };
  return {
    base,
    async start() {
      if (URL_ENV) return;
      const outDir = process.env.E2E_TODAY_DIST ?? 'dist';
      server = spawn(
        'npx',
        [
          'vite',
          'preview',
          '--outDir',
          outDir,
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
          '--strictPort',
        ],
        { cwd: path.join(ROOT, 'client'), stdio: 'ignore' },
      );
      await waitForServer();
    },
    stop() {
      server?.kill();
    },
  };
}

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** The Firebase web API key baked into the bundle (the signed-in user is stored under it). */
async function bundleApiKey(page: Page, base: string): Promise<string> {
  const html = await (await page.request.get(base + '/')).text();
  for (const m of html.matchAll(/src="([^"]*\.js)"/g)) {
    const js = await (await page.request.get(new URL(m[1]!, base + '/').toString())).text();
    const k = js.match(/AIza[0-9A-Za-z_-]{35}/);
    if (k) return k[0];
  }
  return 'e2e-api-key';
}

export const ASSIGNMENT = {
  program: {
    id: 'e2e-prg',
    name: 'Upper / Lower',
    weeks: 8,
    daysPerWeek: 3,
    items: [1, 2, 3].flatMap((day) =>
      [1, 2, 3].map((position) => ({
        id: `i${day}${position}`,
        day,
        position,
        name: ['Bench Press', 'Squat', 'Deadlift'][position - 1],
        kind: 'strength',
        sets: 3,
        reps: 8,
        durationMin: null,
        equipment: [],
      })),
    ),
  },
  assignedBy: null,
  week: 1,
  done: 0,
  total: 3,
  expectedSoFar: 1,
  adherence: null,
};

/** How the stubbed `programMine` callable answers; changeable between page loads. */
export interface Stub {
  delayMs: number;
  assignment: boolean;
}

/**
 * A returning member (restored from localStorage like the SDK does). Nothing leaves localhost except `programMine`, which
 * is answered by us after `stub.delayMs`: the late arrival of the week card is exactly what SPO-102 is about.
 */
export async function arm(page: Page, stub: Stub, base: string, locale = 'en'): Promise<void> {
  const apiKey = await bundleApiKey(page, base);
  const now = Math.floor(Date.now() / 1000);
  const jwt = [
    b64url({ alg: 'none', typ: 'JWT' }),
    b64url({
      iss: 'e2e',
      aud: 'e2e',
      sub: 'e2e-m',
      user_id: 'e2e-m',
      role: 'member',
      iat: now,
      exp: now + 86_400 * 30,
    }),
    'sig',
  ].join('.');
  await page.addInitScript(
    ({ apiKey, jwt, locale }) => {
      // Seed once per tab: a reload keeps what the app stored itself (e.g. the week-card height hint).
      if (sessionStorage.getItem('e2e.seeded')) return;
      sessionStorage.setItem('e2e.seeded', '1');
      localStorage.setItem('gym.locale', locale);
      localStorage.setItem('spotter.uid', 'e2e-m');
      localStorage.setItem('spotter.role', 'member');
      // A complete profile (no setup gate). History is logged through the UI in visit 1 (Firestore's offline cache keeps it).
      const day = 86_400_000;
      localStorage.setItem(
        'spotter.body',
        JSON.stringify({
          heightCm: 180,
          weights: [{ id: 'e2e-b1', at: Date.now() - day, weight: 80 }],
        }),
      );
      localStorage.setItem(
        `firebase:authUser:${apiKey}:[DEFAULT]`,
        JSON.stringify({
          uid: 'e2e-m',
          email: null,
          emailVerified: false,
          isAnonymous: false,
          providerData: [],
          stsTokenManager: {
            refreshToken: 'e2e',
            accessToken: jwt,
            expirationTime: Date.now() + 30 * 86_400_000,
          },
          createdAt: String(Date.now()),
          lastLoginAt: String(Date.now()),
          apiKey,
          appName: '[DEFAULT]',
        }),
      );
    },
    { apiKey, jwt, locale },
  );
  // CLS collector, live from the first script on (`buffered` also replays entries from before it was created).
  await page.addInitScript(() => {
    const w = window as unknown as {
      __cls: number;
      __shifts: { t: number; v: number; src: string[] }[];
    };
    w.__cls = 0;
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        startTime: number;
        sources?: { node?: Element | null }[];
      }[]) {
        if (e.hadRecentInput) continue;
        w.__cls += e.value;
        const src = (e.sources ?? []).map((s) => {
          const n = s.node as HTMLElement | null | undefined;
          return n ? `${n.tagName.toLowerCase()}.${String(n.className).slice(0, 40)}` : '?';
        });
        w.__shifts.push({
          t: Math.round(e.startTime),
          v: Math.round(e.value * 10000) / 10000,
          src,
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
    // First moment a week card (stand-in or real) exists on Today: the anchor of the "t = 0.3 s / 3 s" samples.
    new MutationObserver((_m, obs) => {
      if (!document.querySelector('.today-page .td-week')) return;
      (window as unknown as { __weekAt: number }).__weekAt = performance.now();
      obs.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
  };
  await page.route(
    (url) => !['127.0.0.1', 'localhost'].includes(url.hostname),
    async (route) => {
      const req = route.request();
      if (!req.url().endsWith('/programMine')) return route.abort('blockedbyclient');
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      await new Promise((r) => setTimeout(r, stub.delayMs));
      return route
        .fulfill({
          status: 200,
          headers: { ...cors, 'content-type': 'application/json' },
          body: JSON.stringify({ result: { assignment: stub.assignment ? ASSIGNMENT : null } }),
        })
        .catch(() => undefined); // the page navigated away meanwhile
    },
  );
}

/** Log one finished past session through the UI: the week card only stands in for members who have history. */
export async function logPastSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Log a past session/ }).click();
  await page.getByRole('button', { name: /Continue to exercises/ }).click();
  await page.getByText('Barbell Bench Press - Medium Grip').first().click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/1 sets/)).toBeVisible();
}

/** First run of an account asks for height + weight before the app; fill it like a person would. */
export async function passProfileGate(page: Page): Promise<void> {
  const deadline = Date.now() + 120_000;
  let todaySince = 0;
  // The gate can show up after a first Today paint (profile arrives late), so keep looking until Today is stable.
  while (Date.now() < deadline) {
    const gate = page.locator('.body-gate input');
    if (await gate.first().isVisible()) {
      todaySince = 0;
      await gate.nth(0).fill('180');
      await gate.nth(1).fill('80');
      await page.locator('.body-gate button').last().click(); // locale-independent "Done, enter the app"
    } else if (await page.locator('.today-page').isVisible()) {
      todaySince ||= Date.now();
      if (Date.now() - todaySince > 1500) return;
    } else {
      todaySince = 0;
    }
    await page.waitForTimeout(150);
  }
  await expect(page.locator('.today-page')).toBeVisible({ timeout: 1000 });
}

/**
 * Repeats `act` until `done()` holds, answering the profile gate whenever it is on screen (SPO-405). The gate can come
 * back after Today has been stable: it only appears once the first sync has resolved, and on a slow runner that is
 * later than `passProfileGate`'s stability window. A one-off `passProfileGate` followed by a plain click or
 * `toBeVisible` is therefore a race; this keeps answering the gate until the step has really happened. Nothing is
 * loosened: the caller still asserts its own outcome after `done()`.
 */
export async function actThroughGate(
  page: Page,
  done: () => Promise<boolean>,
  act: () => Promise<void> = async () => undefined,
  timeoutMs = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await done().catch(() => false)) return;
    const gate = page.locator('.body-gate input');
    if (await gate.first().isVisible()) {
      await gate.nth(0).fill('180');
      await gate.nth(1).fill('80');
      await page.locator('.body-gate button').last().click(); // locale-independent "Done, enter the app"
    } else {
      await act().catch(() => undefined); // not there yet (or the gate covered it again): look again
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`actThroughGate: the step did not happen within ${timeoutMs} ms`);
}

export interface Geometry {
  /** Bottom of the week card to the top of the next visible block after it (the banner / status stack), px. */
  gap: number | null;
  weekHeight: number | null;
  nextClass: string | null;
  /** Notice banners (`.uinotice`, e.g. "Syncing" / "offline, N queued") on Today. */
  banners: number;
}

export const geometry = (page: Page): Promise<Geometry> =>
  page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.today-page .td-week');
    const banners = document.querySelectorAll('.today-page .uinotice').length;
    if (!card) return { gap: null, weekHeight: null, nextClass: null, banners };
    let next: Element | null = card.nextElementSibling;
    while (next && next.getBoundingClientRect().height === 0) next = next.nextElementSibling;
    const cr = card.getBoundingClientRect();
    const r1 = (n: number) => Math.round(n * 10) / 10;
    return {
      gap: next ? r1(next.getBoundingClientRect().top - cr.bottom) : null,
      weekHeight: r1(cr.height),
      nextClass: next ? String((next as HTMLElement).className).slice(0, 60) : null,
      banners,
    };
  });

/** Wait until the page's own clock (performance.now, 0 = navigation start) reaches `ms`. */
export const atPageTime = (page: Page, ms: number) =>
  page.waitForFunction((t) => performance.now() >= t, ms, { polling: 25, timeout: 120_000 });

/** Slow 3G through CDP; drops the service worker + HTTP cache first so the reload is a cold, throttled start. */
export async function throttleSlow3g(page: Page, context: BrowserContext): Promise<void> {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  });
  await cdp.send('Network.clearBrowserCache');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: (500 * 1024) / 8,
    uploadThroughput: (500 * 1024) / 8,
  });
}

/** The CLS collected by the `arm` init script, plus the individual shifts and the elements that moved. */
export const readCls = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __cls: number; __shifts: unknown[] };
    return { cls: w.__cls, shifts: w.__shifts };
  });
