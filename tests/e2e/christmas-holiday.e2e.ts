/**
 * SPO-393: the Christmas holiday window in the production build, with the clock mocked. Inside 18.12–01.01 the app
 * wears Christmas by itself; outside it never does. Nothing leaves localhost and nothing is written to the backend.
 *
 * Needs a built client (see helpers/layout-shift.ts). Run:
 * `npx playwright test tests/e2e/christmas-holiday.e2e.ts --project=mobile-chromium`.
 */
import { expect, test, type Page } from '@playwright/test';
import { arm, makeHarness, passProfileGate, type Stub } from './helpers/layout-shift';

const harness = makeHarness(4179);
const BASE = harness.base;

test.beforeAll(async () => {
  await harness.start();
});
test.afterAll(() => {
  harness.stop();
});

const CONSENT_VERIFIED = JSON.stringify({
  'e2e-m': 'terms@2026-10-21,policy-ack@2026-11-01,age-18@2026-10-21',
});
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

async function openTodayAt(page: Page, iso: string) {
  await page.clock.install({ time: new Date(iso) });
  const stub: Stub = { delayMs: 0, assignment: true };
  await arm(page, stub, BASE, 'en');
  await page.addInitScript(
    (v) => localStorage.setItem('spotter.consentVerified', v),
    CONSENT_VERIFIED,
  );
  await page.goto(BASE + '/');
  await passProfileGate(page);
}

for (const day of ['2026-12-18T12:00:00', '2026-12-25T12:00:00', '2027-01-01T12:00:00']) {
  test(`${day.slice(0, 10)}: Christmas is on`, async ({ page }) => {
    test.setTimeout(60_000);
    await openTodayAt(page, day);
    await expect.poll(() => theme(page), { timeout: 30_000 }).toBe('christmas');
  });
}

for (const day of ['2026-12-10T12:00:00', '2027-01-02T12:00:00']) {
  test(`${day.slice(0, 10)}: Christmas is not on`, async ({ page }) => {
    test.setTimeout(60_000);
    await openTodayAt(page, day);
    await page.waitForTimeout(1500);
    expect(await theme(page)).not.toBe('christmas');
  });
}
