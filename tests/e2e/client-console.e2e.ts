/**
 * SPO-337: the client must not log errors to the console. Cold start of the signed-out shell (landing + sign-in) on a
 * production build, with the backend unreachable (like offline-startup.e2e.ts): any `console.error` or uncaught page
 * error fails the test. Backend/network noise caused by the blocked hosts is the only allowlisted source.
 *
 * Needs a built client on E2E_BASE_URL (default http://127.0.0.1:4173). Run:
 * `npx playwright test tests/e2e/client-console.e2e.ts --project=mobile-chromium`.
 */
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const BACKEND_HOSTS = [
  '**/*.googleapis.com/**',
  '**/*.cloudfunctions.net/**',
  '**/*.firebaseapp.com/**',
  '**/*.firebaseio.com/**',
  '**/www.google.com/recaptcha/**',
  '**/www.gstatic.com/**',
];
/** Errors that only exist because the test blocks the backend (the browser reports the failed request itself). */
const BLOCKED_NOISE =
  /ERR_BLOCKED_BY_CLIENT|ERR_INTERNET_DISCONNECTED|Failed to load resource|net::ERR_|googleapis|cloudfunctions|firebaseio|recaptcha/i;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (BLOCKED_NOISE.test(text) || BLOCKED_NOISE.test(m.location().url ?? '')) return;
    errors.push(text);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gym.locale', 'en'));
  for (const pattern of BACKEND_HOSTS) await page.route(pattern, (r) => r.abort('blockedbyclient'));
});

for (const path of ['/', '/today', '/history', '/progress', '/gyms', '/settings']) {
  test(`cold start at ${path} logs no console errors`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(BASE + path);
    await page.locator('#root *').first().waitFor({ timeout: 10_000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1_500);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
