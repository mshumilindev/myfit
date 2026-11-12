/**
 * SPO-63: an unstable connection (slow, then flapping on and off) does not lose a single set in a running workout.
 * Sets are logged on a throttled line, then while the line drops and returns again and again; the counter in the session
 * header must show every one of them and the app must not raise an error.
 *
 * Needs a built client on E2E_BASE_URL (default http://127.0.0.1:4173).
 * Run: `npx playwright test tests/e2e/flaky-network.e2e.ts --project=mobile-chromium`.
 */
import { expect, test } from '@playwright/test';
import { arm, passProfileGate, type Stub } from './helpers/layout-shift';

const BASE = process.env.E2E_TODAY_URL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const CONSENT_VERIFIED = JSON.stringify({
  'e2e-m': 'terms@2026-11-12,policy-ack@2026-11-12,age-18@2026-10-21',
});
const FLAPS = 4;

test('every set survives a slow line and a line that keeps dropping', async ({ page, context }) => {
  test.setTimeout(120_000);
  await arm(page, { delayMs: 0, assignment: false } satisfies Stub, BASE, 'en');
  await page.addInitScript(
    (v) => localStorage.setItem('spotter.consentVerified', v),
    CONSENT_VERIFIED,
  );
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(BASE + '/');
  await passProfileGate(page);
  await page.waitForTimeout(3_000);
  await passProfileGate(page);

  // a workout is started online (its screens get cached), then the line turns bad
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: /^Start a session/ }).click();
  await page.getByText('Without a gym').click();
  await page.getByText('Barbell Squat').first().click();
  const log = page.getByRole('button', { name: 'Log', exact: true });
  await log.click();
  await expect(page.getByText(/^1 sets/).first()).toBeVisible();

  // slow line: high latency, low throughput
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 1_500,
    downloadThroughput: 20_000,
    uploadThroughput: 20_000,
  });
  await log.click();
  await expect(page.getByText(/^2 sets/).first()).toBeVisible();

  // flapping line: drops and returns around every set
  let logged = 2;
  for (let i = 0; i < FLAPS; i += 1) {
    await context.setOffline(true);
    await log.click();
    logged += 1;
    await context.setOffline(false);
    await log.click();
    logged += 1;
    await expect(page.getByText(new RegExp(`^${logged} sets`)).first()).toBeVisible();
  }

  // the line settles: nothing was lost, nothing alarming on screen, no uncaught error
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await page.waitForTimeout(2_000);
  await expect(page.getByText(new RegExp(`^${logged} sets`)).first()).toBeVisible();
  await expect(page.locator('[role="alert"]')).toHaveCount(0);

  // and the device really holds them all: after a reload the running workout shows the same number of sets
  await page.reload();
  await passProfileGate(page);
  await expect(page.getByText(new RegExp(`^${logged} ·`)).first()).toBeVisible({ timeout: 20_000 });
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});
