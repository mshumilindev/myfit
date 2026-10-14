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

test('coach shows the DEMO notice on the fixtures backend', async ({ page }) => {
  await openCoach(page, '#/c/today');
  await expect(page.getByText(/demo|sample/i).first()).toBeVisible();
});
