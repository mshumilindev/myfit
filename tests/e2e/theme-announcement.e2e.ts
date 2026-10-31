/**
 * SPO-357 / SPO-355: the new-theme announcement in the production build. A returning member (nothing leaves localhost,
 * nothing is written to the backend) sees the invite on Today, tries the theme (Preview), and either keeps the current
 * look (button or Esc) or uses the new one. The preview itself saves nothing; offline, Use still sticks on the device.
 *
 * Needs a built client (see helpers/layout-shift.ts: E2E_TODAY_URL / E2E_TODAY_DIST). Run:
 * `npx playwright test tests/e2e/theme-announcement.e2e.ts --project=mobile-chromium`.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  actThroughGate,
  arm,
  makeHarness,
  passProfileGate,
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

const CONSENT_VERIFIED = JSON.stringify({
  'e2e-m': 'terms@2026-10-21,policy-ack@2026-10-31,age-18@2026-10-21',
});
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

/** The invite is on Today (the profile gate may still come back first, SPO-405): press Preview until the dock is up. */
async function openPreview(page: Page) {
  const dock = page.getByRole('region', { name: /theme preview/i });
  await actThroughGate(
    page,
    () => dock.isVisible(),
    () =>
      page
        .frameLocator('.thinv iframe')
        .getByRole('button', { name: 'Preview' })
        .click({ timeout: 2_000 }),
    75_000,
  );
  await expect(dock).toBeVisible();
  return dock;
}

async function openToday(page: Page) {
  const stub: Stub = { delayMs: 0, assignment: true };
  await arm(page, stub, BASE, 'en');
  await page.addInitScript(
    (v) => localStorage.setItem('spotter.consentVerified', v),
    CONSENT_VERIFIED,
  );
  await page.goto(BASE + '/');
  await passProfileGate(page);
}

test('invite → Preview → Keep current: the old look is back and nothing is saved', async ({
  page,
}) => {
  test.setTimeout(100_000);
  await openToday(page);
  const savedBefore = await theme(page);
  const dock = await openPreview(page);
  expect(await theme(page)).not.toBe(savedBefore);
  await dock.getByRole('button', { name: 'Keep current' }).click();
  await expect(dock).toHaveCount(0);
  expect(await theme(page)).toBe(savedBefore);
  expect(await page.evaluate(() => localStorage.getItem('gym.theme'))).toBeNull();
  await expect(page.locator('.thinv')).toHaveCount(0); // answered: not offered again
});

test('Esc on the dock is Keep current', async ({ page }) => {
  test.setTimeout(100_000);
  await openToday(page);
  const savedBefore = await theme(page);
  const dock = await openPreview(page);
  await page.keyboard.press('Escape');
  await expect(dock).toHaveCount(0);
  expect(await theme(page)).toBe(savedBefore);
  expect(await page.evaluate(() => localStorage.getItem('gym.theme'))).toBeNull();
});

test('Use sticks on the device, also offline, and survives a reload', async ({ page, context }) => {
  test.setTimeout(100_000);
  await openToday(page);
  const dock = await openPreview(page);
  const previewed = await theme(page);
  await context.setOffline(true);
  await dock.getByRole('button', { name: /^Use / }).click();
  await expect(dock).toHaveCount(0);
  expect(await theme(page)).toBe(previewed);
  expect(await page.evaluate(() => localStorage.getItem('gym.theme'))).toBe(previewed);
  await context.setOffline(false);
  await page.reload();
  await passProfileGate(page);
  expect(await theme(page)).toBe(previewed);
  await expect(page.locator('.thinv')).toHaveCount(0);
});
