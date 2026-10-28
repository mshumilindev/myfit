/**
 * SPO-337: a signed-in member's console stays clean. Warm start (full reloads of every main screen with the data already
 * on the device) and offline (the same screens after the network is cut). Uses the shared returning-member harness: nothing
 * leaves localhost, nothing is written to the backend. Any `console.error` or uncaught page error fails the test;
 * failed requests caused by the cut network are the only allowlisted source.
 *
 * Needs a built client on E2E_BASE_URL (default http://127.0.0.1:4173). Run:
 * `npx playwright test tests/e2e/client-console-member.e2e.ts --project=mobile-chromium`.
 */
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import { arm, passProfileGate, type Stub } from './helpers/layout-shift';

const BASE = process.env.E2E_TODAY_URL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const CONSENT_VERIFIED = JSON.stringify({
  'e2e-m': 'terms@2026-10-21,policy-ack@2026-10-28,age-18@2026-10-21',
});
/** Errors that exist only because the network is cut (the browser reports the failed request itself). */
const NETWORK_NOISE =
  /ERR_BLOCKED_BY_CLIENT|ERR_INTERNET_DISCONNECTED|Failed to load resource|net::ERR_|Could not reach Cloud Firestore backend|googleapis|cloudfunctions|firebaseio|recaptcha|@firebase\/firestore.*transport errored/i;
const SCREENS = ['/today', '/history', '/progress', '/gyms', '/settings'];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const text = m.text();
    if (NETWORK_NOISE.test(text) || NETWORK_NOISE.test(m.location().url ?? '')) return;
    errors.push(`${text} (${m.location().url ?? ''})`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

test('member: warm start of every main screen, then offline, logs no console errors', async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  const stub: Stub = { delayMs: 0, assignment: true };
  await arm(page, stub, BASE, 'en');
  await page.addInitScript(
    (v) => localStorage.setItem('spotter.consentVerified', v),
    CONSENT_VERIFIED,
  );
  const errors = collectErrors(page);
  await page.goto(BASE + '/');
  await passProfileGate(page);

  // warm start: a full reload of each screen with the data already stored on the device
  for (const path of SCREENS) {
    await page.goto(BASE + path);
    await page.locator('#root *').first().waitFor({ timeout: 10_000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1_000);
  }
  expect(errors, `warm start:\n${errors.join('\n')}`).toEqual([]);

  // offline: the shell comes from the local cache and the screens still open
  await page.goto(BASE + '/today');
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await context.setOffline(true);
  for (const path of SCREENS) {
    await page.goto(BASE + path).catch(() => undefined);
    await page.locator('#root *').first().waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1_000);
  }
  expect(errors, `offline:\n${errors.join('\n')}`).toEqual([]);
  await expect(page.locator('#root')).not.toBeEmpty();
});
