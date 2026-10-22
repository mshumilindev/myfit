/**
 * SPO-102: the Today screen must not shift while it loads. The week card (program assignment) arrives AFTER first paint,
 * and the banners/stack below it used to jump when it did. This spec opens the member Today in the production build with
 * Firebase unreachable and the `programMine` callable answered by us after a delay, then proves
 *   (a) CLS < 0.05 (PerformanceObserver `layout-shift`, buffered, ignoring shifts right after input),
 *   (a) the vertical gap between `.td-week` and the next block (the banner/status stack) is the same at t=0.3 s and t=3 s,
 *   (c) the same on slow 3G (CDP Network.emulateNetworkConditions).
 *
 * Needs a built client served somewhere. By default the spec starts `vite preview` on :4176 over `client/dist`
 * (`npm run build -w client`); E2E_TODAY_URL=<url> reuses a server you already run; E2E_TODAY_DIST=<dir> picks another
 * outDir (e.g. `client/dist-e2e`). Run: `npx playwright test tests/e2e/today-layout-shift.e2e.ts --project=mobile-chromium`.
 */
import { expect, test, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const PORT = 4176;
const URL_ENV = process.env.E2E_TODAY_URL;
const BASE = URL_ENV ?? `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(__dirname, '../..');
/** Max CLS accepted (AC of SPO-102). */
const CLS_BUDGET = 0.05;
/** When the stubbed `programMine` callable answers (after the first paint, like the real network read). */
const ASSIGNMENT_DELAY_MS = 1200;

let server: ChildProcess | undefined;

async function waitForServer(): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`no server at ${BASE}`);
}

test.beforeAll(async () => {
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
      String(PORT),
      '--strictPort',
    ],
    { cwd: path.join(ROOT, 'client'), stdio: 'ignore' },
  );
  await waitForServer();
});

test.afterAll(() => {
  server?.kill();
});

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** The Firebase web API key baked into the bundle (the signed-in user is stored under it). */
async function bundleApiKey(page: Page): Promise<string> {
  const html = await (await page.request.get(BASE + '/')).text();
  for (const m of html.matchAll(/src="([^"]*\.js)"/g)) {
    const js = await (await page.request.get(new URL(m[1]!, BASE + '/').toString())).text();
    const k = js.match(/AIza[0-9A-Za-z_-]{35}/);
    if (k) return k[0];
  }
  return 'e2e-api-key';
}

const ASSIGNMENT = {
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
interface Stub {
  delayMs: number;
  assignment: boolean;
}

/**
 * A returning member (restored from localStorage like the SDK does). Nothing leaves localhost except `programMine`, which
 * is answered by us after `stub.delayMs`: the late arrival of the week card is exactly what SPO-102 is about.
 */
async function arm(page: Page, stub: Stub): Promise<void> {
  const apiKey = await bundleApiKey(page);
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
    ({ apiKey, jwt }) => {
      // Seed once per tab: a reload keeps what the app stored itself (e.g. the week-card height hint).
      if (sessionStorage.getItem('e2e.seeded')) return;
      sessionStorage.setItem('e2e.seeded', '1');
      localStorage.setItem('gym.locale', 'en');
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
    { apiKey, jwt },
  );
  // CLS collector, live from the first script on (`buffered` also replays entries from before it was created).
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number; __shifts: { t: number; v: number }[] };
    w.__cls = 0;
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        startTime: number;
      }[]) {
        if (e.hadRecentInput) continue;
        w.__cls += e.value;
        w.__shifts.push({ t: Math.round(e.startTime), v: Math.round(e.value * 10000) / 10000 });
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
async function logPastSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Log a past session/ }).click();
  await page.getByRole('button', { name: /Continue to exercises/ }).click();
  await page.getByText('Barbell Bench Press - Medium Grip').first().click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/1 sets/)).toBeVisible();
}

/** First run of an account asks for height + weight before the app; fill it like a person would. */
async function passProfileGate(page: Page): Promise<void> {
  await page.locator('.body-gate, .today-page').first().waitFor({ timeout: 120_000 });
  const gate = page.locator('.body-gate input');
  if (await gate.first().isVisible()) {
    await gate.nth(0).fill('180');
    await gate.nth(1).fill('80');
    await page.getByRole('button', { name: /Done, enter/ }).click();
  }
  await expect(page.locator('.today-page')).toBeVisible({ timeout: 120_000 });
}

interface Geometry {
  /** Bottom of the week card to the top of the next visible block after it (the banner / status stack), px. */
  gap: number | null;
  weekHeight: number | null;
  nextClass: string | null;
  /** Notice banners (`.uinotice`, e.g. "Syncing" / "offline, N queued") on Today. */
  banners: number;
}

const geometry = (page: Page): Promise<Geometry> =>
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
const atPageTime = (page: Page, ms: number) =>
  page.waitForFunction((t) => performance.now() >= t, ms, { polling: 25, timeout: 120_000 });

for (const scenario of [
  { name: 'fast network', slow3g: false },
  { name: 'slow 3G', slow3g: true },
] as const) {
  test(`Today does not shift while it loads: ${scenario.name}`, async ({ page, context }) => {
    test.setTimeout(160_000);
    const stub: Stub = { delayMs: 0, assignment: true };
    await arm(page, stub);

    // Visit 1: the app learns the height of the week card (returning-user hint, SPO-102).
    await page.goto(BASE + '/');
    await passProfileGate(page);
    await expect(page.locator('.today-page .td-week:not([data-mode="none"])')).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(1000); // let the screen settle before driving the sheets
    await logPastSession(page);
    await page.reload(); // the hint is written when the card renders; history changes its height, so re-learn it
    await passProfileGate(page);
    await expect(page.locator('.today-page .td-week:not([data-mode="none"])')).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(600);
    expect(
      Number(await page.evaluate(() => localStorage.getItem('spotter.todayWeekH.m'))),
    ).toBeGreaterThan(0);

    // Visit 2 (measured): the card arrives ASSIGNMENT_DELAY_MS late.
    stub.delayMs = ASSIGNMENT_DELAY_MS;
    if (scenario.slow3g) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      // Without this the service worker and the HTTP cache answer the reload and nothing is throttled (a warm start).
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
    await page.reload();
    await passProfileGate(page);

    // The page is slow to boot on a shared box, so "t" counts from the first render of the week card (stand-in or real)
    // rather than from navigation: t = 0.3 s and t = 3 s after Today first shows it, plus samples in between.
    await page.waitForFunction(
      () => (window as unknown as { __weekAt?: number }).__weekAt !== undefined,
      null,
      {
        timeout: 120_000,
      },
    );
    const weekAt = await page.evaluate(() => (window as unknown as { __weekAt: number }).__weekAt);
    const samples: { t: number; g: Geometry }[] = [];
    for (const offset of [0, 300, 600, 1000, 1500, 2000, 2500, 3000]) {
      await atPageTime(page, weekAt + offset);
      const [t, g] = await Promise.all([
        page.evaluate((w) => Math.round(performance.now() - w), weekAt),
        geometry(page),
      ]);
      samples.push({ t, g });
    }
    await expect(page.locator('.today-page .td-week:not([data-mode="none"])')).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(500);
    samples.push({ t: -1, g: await geometry(page) }); // once the real card is in
    const at = (offset: number) => samples.find((s) => s.t >= offset)!.g;

    const { cls, shifts } = await page.evaluate(() => {
      const w = window as unknown as { __cls: number; __shifts: unknown[] };
      return { cls: w.__cls, shifts: w.__shifts };
    });
    const gaps = samples.map((s) => s.g.gap).filter((g): g is number => g !== null);
    console.log(
      `[SPO-102 ${scenario.name}] CLS=${cls.toFixed(4)} shifts=${JSON.stringify(shifts)}\n` +
        samples
          .map(
            (s) =>
              `  t+${s.t}ms gap=${s.g.gap} week=${s.g.weekHeight} banners=${s.g.banners} next=${s.g.nextClass}`,
          )
          .join('\n'),
    );
    expect(cls, `CLS ${cls} shifts ${JSON.stringify(shifts)}`).toBeLessThan(CLS_BUDGET);
    expect(gaps.length, 'the week card and the block after it were measured').toBeGreaterThan(1);
    // No growth: every sample from the first one equals the last (0.5px = rounding).
    expect(Math.max(...gaps) - Math.min(...gaps), `gaps ${gaps}`).toBeLessThanOrEqual(0.5);
    // The two instants of the AC.
    expect(Math.abs(at(300).gap! - at(3000).gap!)).toBeLessThanOrEqual(0.5);
  });
}
