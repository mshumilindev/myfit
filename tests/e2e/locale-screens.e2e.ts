/**
 * SPO-62 AC2: the key member screens in all five locales (en, uk, pl, lt, et) on a phone. Per locale and screen: the screen
 * renders, the page does not scroll sideways, the document language is the locale's, and a screenshot is attached to the
 * report so a person can look at the long languages (pl, lt, et). Across locales the navigation text must differ, so a
 * locale that silently falls back to English fails. Pixel baselines are SPO-59; geometry of every kit story in all
 * locales is `scripts/story-audit.mjs`.
 *
 * Same returning-member harness as client-console-member.e2e.ts: nothing leaves localhost, nothing is written.
 * Needs a built client on E2E_BASE_URL. Run: `npx playwright test tests/e2e/locale-screens.e2e.ts --project=mobile-chromium`.
 */
import { expect, test } from '@playwright/test';
import { arm, passProfileGate, type Stub } from './helpers/layout-shift';

const BASE = process.env.E2E_TODAY_URL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const CONSENT_VERIFIED = JSON.stringify({
  'e2e-m': 'terms@2026-10-21,policy-ack@2026-11-05,age-18@2026-10-21',
});
const LOCALES = ['en', 'uk', 'pl', 'lt', 'et'] as const;
const SCREENS = ['/today', '/history', '/progress', '/gyms', '/settings'] as const;
const navText: Record<string, string> = {};

for (const locale of LOCALES) {
  test(`key screens in ${locale}: render, no sideways scroll, own language, screenshot`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(150_000);
    const stub: Stub = { delayMs: 0, assignment: false };
    await arm(page, stub, BASE, locale);
    await page.addInitScript(
      (v) => localStorage.setItem('spotter.consentVerified', v),
      CONSENT_VERIFIED,
    );
    await page.goto(BASE + '/');
    await passProfileGate(page);

    for (const path of SCREENS) {
      await page.goto(BASE + path);
      await page.locator('#root *').first().waitFor({ timeout: 10_000 });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.waitForTimeout(800);

      expect(await page.locator('html').getAttribute('lang'), `lang on ${path}`).toBe(locale);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `sideways scroll on ${path} in ${locale}`).toBeLessThanOrEqual(0);
      const shot = await page.screenshot({ fullPage: false });
      expect(shot.length, `screenshot of ${path} in ${locale} is blank`).toBeGreaterThan(5_000);
      await testInfo.attach(`${locale}${path.replace('/', '-')}.png`, {
        body: shot,
        contentType: 'image/png',
      });
    }

    navText[locale] = (await page.locator('.tabbar').first().innerText()).replace(/\s+/g, ' ');
    expect(navText[locale].length, `no navigation text in ${locale}`).toBeGreaterThan(0);
    // The navigation must be in this locale, not the English fallback.
    if (locale !== 'en' && navText.en)
      expect(navText[locale], `${locale} nav = en nav`).not.toBe(navText.en);
  });
}
