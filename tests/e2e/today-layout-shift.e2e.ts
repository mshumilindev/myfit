/**
 * SPO-102: the Today screen must not shift while it loads. The week card (program assignment) arrives AFTER first paint,
 * and the banners/stack below it used to jump when it did. This spec opens the member Today in the production build with
 * Firebase unreachable and the `programMine` callable answered by us after a delay, then proves
 *   (a) CLS < 0.05 (PerformanceObserver `layout-shift`, buffered, ignoring shifts right after input),
 *   (a) the vertical gap between `.td-week` and the next block (the banner/status stack) is the same at t=0.3 s and t=3 s,
 *   (c) the same on slow 3G (CDP Network.emulateNetworkConditions),
 *   (d) the same in all 5 locales (AC4); Overview and History are covered by layout-shift-screens.e2e.ts (AC8).
 *
 * Needs a built client served somewhere. By default the spec starts `vite preview` on :4176 over `client/dist`
 * (`npm run build -w client`); E2E_TODAY_URL=<url> reuses a server you already run; E2E_TODAY_DIST=<dir> picks another
 * outDir (e.g. `client/dist-e2e`). Run: `npx playwright test tests/e2e/today-layout-shift.e2e.ts --project=mobile-chromium`.
 * E2E_LOCALES=en,uk limits the locales.
 */
import { expect, test } from '@playwright/test';
import {
  ASSIGNMENT_DELAY_MS,
  CLS_BUDGET,
  arm,
  atPageTime,
  geometry,
  logPastSession,
  makeHarness,
  passProfileGate,
  readCls,
  throttleSlow3g,
  type Geometry,
  type Stub,
} from './helpers/layout-shift';

const harness = makeHarness(4176);
const BASE = harness.base;
const LOCALES = (process.env.E2E_LOCALES ?? 'en,uk,pl,lt,et').split(',');

test.beforeAll(async () => {
  await harness.start();
});

test.afterAll(() => {
  harness.stop();
});

for (const locale of LOCALES)
  for (const scenario of [
    { name: 'fast network', slow3g: false },
    { name: 'slow 3G', slow3g: true },
  ] as const) {
    test(`Today does not shift while it loads: ${locale}, ${scenario.name}`, async ({
      page,
      context,
    }) => {
      test.setTimeout(160_000);
      const stub: Stub = { delayMs: 0, assignment: true };
      await arm(page, stub, BASE, 'en'); // visit 1 in English: its UI strings drive the clicks

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
      if (scenario.slow3g) await throttleSlow3g(page, context);
      // Visit 1 ran in English (its UI strings drive the clicks); the measured visit runs in the locale under test.
      await page.evaluate((l) => localStorage.setItem('gym.locale', l), locale);
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
      const weekAt = await page.evaluate(
        () => (window as unknown as { __weekAt: number }).__weekAt,
      );
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

      const { cls, shifts } = await readCls(page);
      const gaps = samples.map((s) => s.g.gap).filter((g): g is number => g !== null);
      console.log(
        `[SPO-102 ${locale} ${scenario.name}] CLS=${cls.toFixed(4)} shifts=${JSON.stringify(shifts)}\n` +
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
