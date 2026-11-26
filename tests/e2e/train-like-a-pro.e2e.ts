/**
 * SPO-307: "Train like a pro" in the production build. A member who has the add-on installed opens the catalog, opens a
 * program, reads its description (Read more / Read less), opens a day to see its exercises, and finds no disclaimer
 * paragraph and no "not checked" line. Without the add-on the route shows nothing. Nothing leaves localhost and nothing
 * is written to the backend (Start is covered by startProgram.test.ts and the setProgramStatus transaction tests).
 *
 * The profile gate can arrive after the first paint and remount the page, which drops the open program (it is view
 * state). So the whole walk is one attempt that restarts from the list whenever the gate answers or the page remounts,
 * and the test passes only when one attempt runs through every assertion.
 *
 * Needs a built client (see helpers/layout-shift.ts: E2E_TODAY_URL / E2E_TODAY_DIST). Run:
 * `npx playwright test tests/e2e/train-like-a-pro.e2e.ts --project=mobile-chromium`.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  actThroughGate,
  arm,
  makeHarness,
  passProfileGate,
  type Stub,
} from './helpers/layout-shift';

const harness = makeHarness(4180);
const BASE = harness.base;
const STEP = { timeout: 2500 };

test.beforeAll(async () => {
  await harness.start();
});
test.afterAll(() => {
  harness.stop();
});

const CONSENT_VERIFIED = JSON.stringify({
  'e2e-m': 'terms@2026-11-12,policy-ack@2026-11-12,age-18@2026-10-21',
});

async function openCatalog(page: Page, installed: boolean) {
  const stub: Stub = { delayMs: 0, assignment: true };
  await arm(page, stub, BASE, 'en', 'member');
  await page.addInitScript(
    ([v, list]) => {
      localStorage.setItem('spotter.consentVerified', v);
      localStorage.setItem('spotter.addons', JSON.stringify({ list: JSON.parse(list) }));
    },
    [CONSENT_VERIFIED, JSON.stringify(installed ? ['gym', 'train-like-a-pro'] : ['gym'])],
  );
  await page.goto(BASE + '/');
  await passProfileGate(page);
  await page.goto(BASE + '/#/train-like-a-pro');
}

/** One walk from the list to the day drawer. Throws (and is retried) when the page is not where the step expects. */
async function walk(page: Page) {
  const more = page.getByRole('button', { name: 'Read more' });
  const less = page.getByRole('button', { name: 'Read less' });
  if (!(await page.locator('.tl-about').isVisible())) {
    await page.locator('.uicc').first().click(STEP);
    await expect(page.locator('.tl-about')).toBeVisible(STEP);
  }
  await more.click(STEP);
  await expect(page.getByText(/Recurring exercises:/)).toBeVisible(STEP);
  await less.click(STEP);
  await expect(page.getByText(/Recurring exercises:/)).toHaveCount(0, STEP);

  await expect(page.getByText(/Not checked against/i)).toHaveCount(0, STEP);
  await expect(page.getByText(/described as published by the source/i)).toHaveCount(0, STEP);

  await page.getByText('Mon', { exact: true }).first().click(STEP);
  await expect(page.locator('.sheet .uirow').first()).toBeVisible(STEP);
}

test.describe('Train like a pro catalog', () => {
  test('open a program, read more, open a day; no disclaimer or "not checked" text', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openCatalog(page, true);
    let walked = false;
    let last: unknown;
    await actThroughGate(
      page,
      async () => walked,
      async () => {
        try {
          await walk(page);
          walked = true;
        } catch (e) {
          last = e; // restarted by the loop; surfaced below if it never passes
          throw e;
        }
      },
      90_000,
    ).catch((e) => {
      throw last ?? e;
    });
    expect(walked).toBe(true);
  });

  test('without the add-on the catalog is not shown', async ({ page }) => {
    test.setTimeout(100_000);
    await openCatalog(page, false);
    await page.waitForTimeout(2500);
    await expect(page.locator('.uicc')).toHaveCount(0);
  });
});
