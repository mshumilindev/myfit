/**
 * Non-blocking startup under offline / very slow network.
 *
 * Needs a built client served on E2E_BASE_URL (default: `npm run build -w client &&
 * npx vite preview --port 4173 --root client`). Scenario C also needs a real test
 * account (E2E_USER / E2E_PASS) against the Firebase project the build points at;
 * without them it is skipped. NOT run in the authoring sandbox (no browser there).
 */
import { expect, test, type Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const HANG_HOSTS = [
  '**/*.googleapis.com/**',
  '**/*.cloudfunctions.net/**',
  '**/*.firebaseapp.com/**',
  '**/*.firebaseio.com/**',
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gym.locale', 'en'));
});

/** A request that never answers: the worst case of a bad connection. */
async function hangBackend(page: Page) {
  for (const pattern of HANG_HOSTS) await page.route(pattern, () => new Promise(() => undefined));
}

/** Nothing may cover the viewport: no scrim, busy region, modal or spinner. */
async function expectNoBlockingOverlay(page: Page) {
  await expect(
    page.locator('.server-busy-scrim, [aria-busy="true"], [aria-modal="true"]'),
  ).toHaveCount(0);
  // The element at the viewport centre must not be a full-viewport fixed layer.
  const blocked = await page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    for (let n: Element | null = el; n; n = n.parentElement) {
      // the app shell itself (body / #root) is a fixed full-viewport scroller by design, not an overlay
      if (n === document.body || n.id === 'root') break;
      const cs = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      if (cs.position === 'fixed' && r.width >= innerWidth - 1 && r.height >= innerHeight - 1) {
        return n.className || n.tagName;
      }
    }
    return null;
  });
  expect(blocked, 'a full-viewport fixed layer sits over the app').toBeNull();
}

test('A. first sign-in screen, offline: form + offline message + Retry, back online clears it', async ({
  page,
  context,
}) => {
  // The shell is delivered once (a first byte cannot arrive offline); the connection then drops under the open form.
  await page.goto(BASE);
  await page.locator('input[type="password"]').first().waitFor({ timeout: 5_000 });
  await context.setOffline(true);
  await expect(page.getByText(/can't reach the server/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /retry/i }).first()).toBeVisible();
  await expectNoBlockingOverlay(page);

  await context.setOffline(false);
  await expect(page.getByText(/can't reach the server/i).first()).toBeHidden({ timeout: 10_000 });
});

test('B. first sign-in screen on a hanging network: usable at once, slow hint after the probe times out', async ({
  page,
}) => {
  await hangBackend(page);
  await page.goto(BASE);
  const password = page.locator('input[type="password"]').first();
  await expect(password).toBeVisible({ timeout: 5_000 });
  await password.fill('secret');
  await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeEnabled(); // probe does not gate
  await expect(page.getByText(/slow to answer/i).first()).toBeVisible({ timeout: 12_000 });
  await expectNoBlockingOverlay(page);
});

test.describe('C. cached session', () => {
  test.skip(!process.env.E2E_USER || !process.env.E2E_PASS, 'needs E2E_USER / E2E_PASS');

  test('shell is interactive offline and on a hanging network; chip clears when back online', async ({
    page,
    context,
  }) => {
    await page.goto(BASE);
    await page.getByPlaceholder(/username/i).fill(process.env.E2E_USER!);
    await page.locator('input[type="password"]').first().fill(process.env.E2E_PASS!);
    await page
      .getByRole('button', { name: /sign in/i })
      .first()
      .click();
    await expect(page.locator('nav')).toBeVisible({ timeout: 20_000 });

    // Reload offline: the shell comes from the local cache, immediately.
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
    await expect(page.locator('nav')).toBeVisible({ timeout: 3_000 });
    await expectNoBlockingOverlay(page);
    await page.locator('nav button').nth(1).click();
    await expect(page).not.toHaveURL(/#\/today$/);
    await expect(page.locator('[data-sync-state="offline"]')).toBeVisible({ timeout: 5_000 });

    // Back online: the chip goes away on its own.
    await context.setOffline(false);
    await expect(page.locator('[data-sync-state="offline"]')).toBeHidden({ timeout: 20_000 });

    // Hanging (not offline) network: still usable, chip says slow with Retry.
    await hangBackend(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('nav')).toBeVisible({ timeout: 3_000 });
    await expectNoBlockingOverlay(page);
  });
});
