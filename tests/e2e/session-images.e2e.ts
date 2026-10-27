/**
 * SPO-358 / SPO-341: the session start screen and the exercise picker show real pictures, never an empty card.
 * A returning member is restored from storage (shared harness: nothing leaves localhost, nothing is written to the
 * backend); a session is started on this device only. Every <img> on the Warm-up hero, the exercise cards and the
 * Warm-up / Cardio / Cool-down tabs of the picker must have decoded (naturalWidth > 0), on a phone and a desktop width.
 *
 * Needs a built client on E2E_TODAY_URL / E2E_BASE_URL (default http://127.0.0.1:4173). Run:
 * `npx playwright test tests/e2e/session-images.e2e.ts --project=mobile-chromium`.
 */
import { expect, test, type Page } from '@playwright/test';
import { arm, passProfileGate, type Stub } from './helpers/layout-shift';

const BASE = process.env.E2E_TODAY_URL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
/** The legal gate lets a device that already saw the server confirm the consents straight in (offline rule). */
const CONSENT_VERIFIED = JSON.stringify({
  'e2e-m': 'terms@2026-10-21,policy-ack@2026-10-21,age-18@2026-10-21',
});

async function broken(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('img')]
      // lazy images below the fold are simply not requested yet (complete = false): only a FAILED decode counts
      .filter((i) => i.complete && i.naturalWidth === 0 && !!(i.currentSrc || i.src))
      .map((i) => i.currentSrc || i.src),
  );
}

// The service worker would answer image requests from its own cache and hide the network from the test.
test.use({ serviceWorkers: 'block' });

const SIZES = [
  { name: 'phone', width: 393, height: 851 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

for (const th of ['glass', 'cyberpunk'])
  for (const size of SIZES) {
    test(`session start and picker pictures load: ${size.name} ${th}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      const failedImages: string[] = [];
      page.on('response', (r) => {
        const t = r.request().resourceType();
        if (t === 'image' && r.status() >= 400) failedImages.push(`${r.status()} ${r.url()}`);
      });
      const stub: Stub = { delayMs: 0, assignment: true };
      await arm(page, stub, BASE, 'en');
      await page.addInitScript(
        (v) => localStorage.setItem('spotter.consentVerified', v),
        CONSENT_VERIFIED,
      );
      await page.addInitScript((t) => localStorage.setItem('gym.theme', t), th);
      await page.goto(BASE + '/');
      await passProfileGate(page);

      await page.getByRole('button', { name: /Start your first session/ }).click();
      await page.getByRole('button', { name: /Or start from scratch/ }).click();
      await page.getByRole('button', { name: /Without a gym/ }).waitFor();
      await page.waitForTimeout(1200); // the sheet slides in: click when it has settled
      await page.getByRole('button', { name: /Without a gym/ }).click();
      await expect(page.getByText('Warm-up', { exact: true }).first()).toBeVisible();
      // on a wide screen the Start sheet stays open next to the session: close it like a person would
      const closeSheet = page
        .locator('.portal-layer')
        .getByRole('button', { name: /cancel|close/i })
        .first();
      if (await closeSheet.isVisible().catch(() => false)) await closeSheet.click();
      await page.waitForTimeout(500);

      // the Warm-up hero shows its picture
      const hero = page.locator('img[src*="/markers/warmup"]').first();
      await expect(hero).toBeVisible();
      await expect
        .poll(() => hero.evaluate((i: HTMLImageElement) => i.naturalWidth))
        .toBeGreaterThan(0);
      await page.waitForTimeout(800);
      expect(await broken(page), 'start screen').toEqual([]);
      expect(failedImages, 'image requests on the start screen').toEqual([]);

      // every tab of the picker (reopened for each: Warm-up / Cardio / Cool-down open their own list)
      for (const tab of ['Strength', 'Warm-up', 'Cardio', 'Cool-down']) {
        await page.getByRole('button', { name: 'Add exercise', exact: true }).first().click();
        await page.locator('.uiseg-opt', { hasText: new RegExp(`^${tab}$`) }).click();
        await page.waitForTimeout(900);
        expect(await broken(page), `picker tab ${tab}`).toEqual([]);
        expect(failedImages, `image requests on ${tab}`).toEqual([]);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    });
  }
