/**
 * SPO-63: the network drops and comes back in the middle of the app, and nothing the person logged is lost.
 * A returning member (shared harness: nothing leaves localhost, nothing is written to the backend). The connection is cut,
 * a past session is logged through the UI (written to Firestore's offline cache), the app is reloaded still offline and the
 * session is there, then the connection returns and the app stays calm.
 *
 * Needs a built client on E2E_BASE_URL (default http://127.0.0.1:4173).
 * Run: `npx playwright test tests/e2e/offline-session.e2e.ts --project=mobile-chromium`.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  arm,
  logPastSession,
  passProfileGate,
  showLoggedWeek,
  type Stub,
} from './helpers/layout-shift';

const BASE = process.env.E2E_TODAY_URL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const CONSENT_VERIFIED = JSON.stringify({
  'e2e-m': 'terms@2026-10-21,policy-ack@2026-11-05,age-18@2026-10-21',
});

/** In-app navigation by the hash route (no full load). */
async function goTo(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
}

test('a workout started offline survives the return of the network and a reload', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const stub: Stub = { delayMs: 0, assignment: false };
  await arm(page, stub, BASE, 'en');
  await page.addInitScript(
    (v) => localStorage.setItem('spotter.consentVerified', v),
    CONSENT_VERIFIED,
  );
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(BASE + '/');
  await passProfileGate(page);
  // the worker must be installed and in control before the line goes down (as for a person on their second visit)
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 15_000,
    })
    .toBe(true);

  // The first sync lands after the first paint; answer the profile gate once more if it shows up late.
  await page.waitForTimeout(3_000);
  await passProfileGate(page);

  // Only the app shell is precached; a screen is cached the first time it is opened (vite.config.ts runtimeCaching).
  // So the person has used the log flow and the history once while online, as a returning member has.
  await logPastSession(page);
  await goTo(page, '#/history');
  await showLoggedWeek(page);
  await expect(page.getByText(/1 sets/)).toHaveCount(1, { timeout: 15_000 });
  await goTo(page, '#/today');

  // the connection drops under the open app: it keeps working and says nothing alarming
  await context.setOffline(true);
  await expect(page.locator('.today-page')).toBeVisible();
  await expect(page.locator('[role="alert"]')).toHaveCount(0);

  // a workout is started and a set logged while offline (the session screens were opened online before, so they are cached)
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: /^Start a session/ }).click();
  await page.getByText('Without a gym').click();
  await page.getByText('Barbell Squat').first().click();
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(page.getByText(/1 sets/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const live = page.getByText(/^live/i).first();
  await expect(live).toBeVisible();

  // the connection returns: the running workout is still there, nothing alarming on screen, no uncaught error
  await context.setOffline(false);
  await page.waitForTimeout(2_000);
  await expect(live).toBeVisible();
  await expect(page.locator('[role="alert"]')).toHaveCount(0);

  // and it survives a full reload (the set was kept on the device and sent when the line came back)
  await page.reload();
  await passProfileGate(page);
  await expect(page.getByText(/^live/i).first()).toBeVisible({ timeout: 20_000 });
  await goTo(page, '#/history');
  await showLoggedWeek(page);
  await expect(page.getByText(/1 sets/).first()).toBeVisible();
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});
