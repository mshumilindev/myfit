/**
 * Coach smoke: every Coach route opens with the fixtures backend through the production build, at 390 / 768 / 1024 / 1440
 * (one Playwright project per width, see playwright.config.ts). Per route: no console errors, no uncaught page errors,
 * no horizontal overflow, no unnamed buttons/links.   Run: `npm run e2e:coach`  (docs/COACH-STATUS.md)
 */
import { expect, test } from '@playwright/test';
import {
  COACH_ROUTES,
  collectConsoleErrors,
  horizontalOverflow,
  openCoach,
  seedTrainer,
  unnamedControls,
} from './coach-helpers';

test.beforeEach(async ({ page, baseURL }) => {
  await seedTrainer(page, baseURL!);
});

for (const hash of COACH_ROUTES) {
  test(`coach route ${hash}`, async ({ page }, info) => {
    const errors = collectConsoleErrors(page);
    await openCoach(page, hash);
    await page.waitForTimeout(500); // lazy screens + first paint of the fixtures world

    expect(errors, `console errors on ${hash}`).toEqual([]);
    expect(
      await horizontalOverflow(page),
      `horizontal overflow on ${hash} @${info.project.name}`,
    ).toBe(0);
    expect(await unnamedControls(page), `unnamed controls on ${hash}`).toEqual([]);
  });
}

// There is no sample-data banner any more: the app never shows stand-in data (coach/BackendNotice.tsx). On the fixtures
// build (e2e only) Coach must serve its screens: the shell is up and it is not the "not configured" state.
test('coach serves its screens on the fixtures backend, not the not-configured state', async ({
  page,
}) => {
  await openCoach(page, '#/c/today');
  await expect(page.locator('#co-main')).toBeVisible();
  await expect(page.getByTestId('coach-not-configured')).toHaveCount(0);
});

// SPO-337: warm start (reload with everything on the device) and offline keep the console clean on the main Coach routes.
test('coach warm start and offline log no console errors', async ({ page, context }) => {
  test.setTimeout(90_000);
  const errors = collectConsoleErrors(page);
  for (const hash of ['#/c/today', '#/c/clients', '#/c/schedule']) {
    await openCoach(page, hash);
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => navigator.serviceWorker?.ready);
  // The worker precaches in the background: go offline only once it controls the page and every route's chunks have been fetched through it.
  await page.reload();
  await page
    .waitForFunction(() => !!navigator.serviceWorker?.controller, undefined, { timeout: 15_000 })
    .catch(() => undefined);
  for (const hash of ['#/c/today', '#/c/clients']) {
    await page.goto('/' + hash);
    await page.waitForLoadState('networkidle').catch(() => undefined);
  }
  await page.waitForTimeout(1500);
  expect(errors, `console errors on warm start`).toEqual([]);
  // A slow runner is still precaching the route chunks (and their stylesheets) in the background: go offline only once
  // every file the worker's precache manifest lists is in the caches, otherwise the first offline visit asks for a file
  // that is not there yet.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const sw = await (await fetch('/sw.js', { cache: 'no-store' })).text();
          const urls = [...new Set(sw.match(/assets\/[\w.-]+\.(?:js|css)/g) ?? [])];
          if (urls.length === 0) return false;
          for (const u of urls) if (!(await caches.match('/' + u))) return u;
          return true;
        }),
      { timeout: 60_000, intervals: [1000] },
    )
    .toBe(true);
  await context.setOffline(true);
  for (const hash of ['#/c/today', '#/c/clients']) {
    await page.goto('/' + hash).catch(() => undefined);
    await page.waitForSelector('#root *', { timeout: 15_000 });
    await page.waitForTimeout(500);
  }
  expect(errors, `console errors on warm start / offline`).toEqual([]);
  await expect(page.locator('#root')).not.toBeEmpty();
});
