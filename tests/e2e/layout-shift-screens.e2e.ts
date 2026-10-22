/**
 * SPO-102 AC8: the async-block layout-shift check of Today, repeated for the other screens that load blocks after first
 * paint, Overview (`#/overview`) and History (`#/history`). Same setup as today-layout-shift.e2e.ts (production build,
 * Firebase unreachable, `programMine` answered by us ASSIGNMENT_DELAY_MS late, shared helpers in ./helpers/layout-shift):
 * a returning member with one logged past session opens the screen cold, CLS is collected from the first script until the
 * screen has settled, and must stay under CLS_BUDGET on a fast network and on slow 3G.
 *
 * Own `vite preview` on :4177 (E2E_TODAY_URL / E2E_TODAY_DIST as in the Today spec). Run:
 * `npx playwright test tests/e2e/layout-shift-screens.e2e.ts --project=mobile-chromium`.
 */
import { expect, test } from '@playwright/test';
import {
  ASSIGNMENT_DELAY_MS,
  CLS_BUDGET,
  arm,
  logPastSession,
  makeHarness,
  passProfileGate,
  readCls,
  throttleSlow3g,
  type Stub,
} from './helpers/layout-shift';

const harness = makeHarness(4177);
const BASE = harness.base;

test.beforeAll(async () => {
  await harness.start();
});

test.afterAll(() => {
  harness.stop();
});

const SCREENS = [
  { name: 'Overview', hash: '#/overview', root: '.ov-page' },
  { name: 'History', hash: '#/history', root: '.hist-list' },
] as const;

for (const screen of SCREENS)
  for (const scenario of [
    { name: 'fast network', slow3g: false },
    { name: 'slow 3G', slow3g: true },
  ] as const) {
    test(`${screen.name} does not shift while it loads: ${scenario.name}`, async ({
      page,
      context,
    }) => {
      test.setTimeout(160_000);
      const stub: Stub = { delayMs: 0, assignment: true };
      await arm(page, stub, BASE, 'en');

      // Visit 1: give the account some history (kept by Firestore's offline cache).
      await page.goto(BASE + '/');
      await passProfileGate(page);
      await expect(page.locator('.today-page .td-week:not([data-mode="none"])')).toBeVisible({
        timeout: 60_000,
      });
      await page.waitForTimeout(1000);
      await logPastSession(page);
      await page.waitForTimeout(600);

      // Visit 2 (measured): cold start straight onto the screen, late network answers.
      stub.delayMs = ASSIGNMENT_DELAY_MS;
      if (scenario.slow3g) await throttleSlow3g(page, context);
      await page.goto(BASE + '/' + screen.hash);
      await page.reload();
      await page.locator(screen.root).waitFor({ timeout: 120_000 });
      await page.waitForTimeout(ASSIGNMENT_DELAY_MS + 3000); // past the late answer, then settle

      const { cls, shifts } = await readCls(page);
      console.log(
        `[SPO-102 ${screen.name} ${scenario.name}] CLS=${cls.toFixed(4)} shifts=${JSON.stringify(shifts)}`,
      );
      expect(cls, `CLS ${cls} shifts ${JSON.stringify(shifts)}`).toBeLessThan(CLS_BUDGET);
    });
  }
