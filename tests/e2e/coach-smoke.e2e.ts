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
