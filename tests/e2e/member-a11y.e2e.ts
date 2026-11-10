/**
 * SPO-60: axe (WCAG 2 A/AA) on the key member screens in every theme, light and dark.
 * Fails on `serious` / `critical` violations that are not in KNOWN; each KNOWN entry needs a reason and only shrinks.
 * Lower-impact findings are attached to the report, not failed. Same returning-member harness as locale-screens.e2e.ts:
 * nothing leaves localhost, nothing is written. Needs a built client on E2E_BASE_URL.
 * Run: `npx playwright test tests/e2e/member-a11y.e2e.ts --project=mobile-chromium` (A11Y_THEMES=glass,studio narrows it).
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { arm, passProfileGate, type Stub } from './helpers/layout-shift';

const require = createRequire(__filename);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.env.E2E_TODAY_URL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const CONSENT_VERIFIED = JSON.stringify({
  'e2e-m': 'terms@2026-10-21,policy-ack@2026-11-05,age-18@2026-10-21',
});
const THEMES = (process.env.A11Y_THEMES ?? 'glass,studio,cyberpunk,christmas,halloween').split(',');
const MODES = ['dark', 'light'] as const;
const SCREENS = ['/today', '/history', '/progress', '/gyms', '/settings'] as const;

/** `rule -> why`, applies to every screen. Keep short; fix the cause and delete the entry. */
const KNOWN: Record<string, string> = {};

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[] }[];
}

for (const theme of THEMES) {
  for (const mode of MODES) {
    test(`axe on member screens: ${theme} ${mode}`, async ({ page }, info) => {
      test.setTimeout(150_000);
      const stub: Stub = { delayMs: 0, assignment: false };
      await arm(page, stub, BASE, 'en');
      await page.addInitScript(
        ([consent, t, m]) => {
          localStorage.setItem('spotter.consentVerified', consent!);
          localStorage.setItem('gym.theme', t!);
          localStorage.setItem('gym.modePref', m!);
          // looks other than Brass Glass are installed add-ons (SPO-500): the harness installs them
          localStorage.setItem(
            'spotter.addons',
            JSON.stringify({
              list: ['theme-brass-glass', 'theme-cyberpunk', 'holiday-themes'],
              updatedAt: 1,
            }),
          );
        },
        [CONSENT_VERIFIED, theme, mode],
      );
      await page.goto(BASE + '/');
      await passProfileGate(page);
      expect(await page.locator('html').getAttribute('data-theme'), 'theme applied').toBe(theme);

      const blocking: string[] = [];
      for (const path of SCREENS) {
        await page.goto(BASE + path);
        await page.locator('#root *').first().waitFor({ timeout: 10_000 });
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await page.waitForTimeout(800);
        if (!(await page.evaluate(() => 'axe' in window)))
          await page.addScriptTag({ content: AXE });
        const violations = (await page.evaluate(async () => {
          const axe = (
            window as unknown as {
              axe: { run: (c: unknown, o: unknown) => Promise<{ violations: unknown[] }> };
            }
          ).axe;
          const r = await axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
          });
          return r.violations;
        })) as AxeViolation[];
        await info.attach(`axe${path.replace('/', '-')}`, {
          body:
            violations.map((v) => `${v.impact} ${v.id} x${v.nodes.length}: ${v.help}`).join('\n') ||
            'none',
          contentType: 'text/plain',
        });
        for (const v of violations)
          if ((v.impact === 'serious' || v.impact === 'critical') && !(v.id in KNOWN))
            blocking.push(
              `${path} ${v.impact} ${v.id}: ${v.help} -> ${v.nodes
                .slice(0, 3)
                .map((n) => n.target.join(' '))
                .join(' | ')}`,
            );
      }
      expect(blocking, `axe on ${theme} ${mode}`).toEqual([]);
    });
  }
}

test('keyboard: Tab walks the Today screen, every stop is visible and shows a focus indicator', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await arm(page, { delayMs: 0, assignment: false }, BASE, 'en');
  await page.addInitScript(
    (c) => localStorage.setItem('spotter.consentVerified', c),
    CONSENT_VERIFIED,
  );
  await page.goto(BASE + '/');
  await passProfileGate(page);
  await page.goto(BASE + '/today');
  await page.locator('#root *').first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);

  const seen = new Set<string>();
  const problems: string[] = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const ring =
        (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
      return {
        id: `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}|${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20)}`,
        visible: r.width > 0 && r.height > 0,
        ring,
      };
    });
    if (!stop) continue;
    seen.add(stop.id);
    if (!stop.visible) problems.push(`invisible focus stop ${stop.id}`);
    if (!stop.ring) problems.push(`no focus indicator on ${stop.id}`);
  }
  expect(seen.size, 'Tab reaches several controls').toBeGreaterThan(4);
  expect(problems).toEqual([]);
});
