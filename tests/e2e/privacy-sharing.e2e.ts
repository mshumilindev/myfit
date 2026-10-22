/**
 * SPO-107 / SPO-108: one sharing list in Privacy and sharing, one way in from My trainer.
 * Runs on the Coach fixtures build (the member-side sample trainer Iryna, scenario `active`), at the coach widths of
 * playwright.config.ts plus a 320 px test; locales come from E2E_LOCALES (default `en`; push to main `en,uk,pl`,
 * nightly all five, ADR 004). Text assertions are English; the geometry checks run in every locale.
 *
 * NOT RUN where it was written (no Playwright/Chromium there): treat the first CI run as its first run.
 * Health-consent states (a feature with no consent, Alcohol sheet) need granted records, which this offline build has no
 * way to seed (Firestore is blocked, so the consent records are unknown and health rows are fail-closed): those two are
 * `fixme` until the fixtures build can seed the health gate; the unit/component tests cover them
 * (coach/client/screens/SharingList.test.tsx, HealthPrivacyAlcohol.test.tsx).
 */
import { expect, test, type Page } from '@playwright/test';
import {
  collectConsoleErrors,
  horizontalOverflow,
  seedTrainer,
  unnamedControls,
} from './coach-helpers';

const LOCALES = (process.env.E2E_LOCALES ?? 'en').split(',').map((l) => l.trim());
const PRIVACY = '#/health/privacy';

async function openAs(
  page: Page,
  origin: string,
  hash: string,
  locale = 'en',
  scenario = 'active',
) {
  await seedTrainer(page, origin, { role: 'member', scenario, name: 'Anna Member', locale });
  await page.goto('/' + hash);
  await page.waitForSelector('#root *', { timeout: 15_000 });
}

const row = (page: Page, title: string) =>
  page.getByRole('button', { name: new RegExp(`^${title},`) });
const summary = (page: Page) => page.locator('.uicard[aria-live="polite"]').first();

test.describe('Privacy and sharing: one list', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await openAs(page, baseURL!, PRIVACY);
    await expect(row(page, 'Workout totals')).toBeVisible({ timeout: 15_000 });
  });

  test('three groups, one summary, no "settings below" hint, Stop sharing is a red row', async ({
    page,
  }) => {
    const heads = await page.locator('.uigl-h').allTextContents();
    for (const h of ['Training', 'Body', 'Lifestyle and health']) expect(heads).toContain(h);
    await expect(page.locator('.uicard[aria-live="polite"]')).toHaveCount(1);
    await expect(page.getByText(/have their own settings below/)).toHaveCount(0);
    const stop = page.getByRole('button', { name: /^Stop sharing with/ });
    await expect(stop).toBeVisible();
    await expect(stop).toHaveClass(/uirow--action/);
  });

  test('changing a level in Training and in Body updates the summary at once', async ({ page }) => {
    await row(page, 'Sleep').click();
    await page
      .getByRole('group', { name: 'Sharing level' })
      .getByText('Full', { exact: true })
      .click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(summary(page)).toContainText('Sleep');
    await expect(row(page, 'Sleep')).toContainText('Full');
    await row(page, 'Sets and weights').click();
    await page
      .getByRole('group', { name: 'Sharing level' })
      .getByText('Off', { exact: true })
      .click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(row(page, 'Sets and weights')).toContainText('Off');
  });

  test('health rows are fail-closed until the consent records are known', async ({ page }) => {
    const alcohol = row(page, 'Alcohol');
    await expect(alcohol).toBeVisible();
    await expect(alcohol).toBeDisabled();
  });

  // fixme: needs a seeded health consent; covered by the component test in coach/client/screens/screens.test.tsx
  // ('a grant row opens the sheet with three levels; Alcohol opens it with two and the reason').
  test.fixme('Alcohol: the sheet has no Full and says why (needs a seeded health consent)', async ({
    page,
  }) => {
    await row(page, 'Alcohol').click();
    await expect(
      page.getByRole('group', { name: 'Sharing level' }).getByRole('button'),
    ).toHaveCount(2);
    await expect(page.getByText('Full is not offered for Alcohol.')).toBeVisible();
  });

  // fixme: needs a seeded health consent; covered by coach/client/screens/SharingList.test.tsx ('a feature without
  // consent reads "Feature is off" ...').
  test.fixme('a feature with no consent reads "Feature is off" (needs a seeded health consent)', async ({
    page,
  }) => {
    await expect(row(page, 'Nicotine')).toContainText('Feature is off');
  });

  test('Stop sharing: step 1, step 2, "sees nothing", then Undo brings it back', async ({
    page,
  }) => {
    const before = await summary(page).innerText();
    await page.getByRole('button', { name: /^Stop sharing with/ }).click();
    await expect(page.getByText('Step 1 of 2')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Step 2 of 2')).toBeVisible();
    await page.getByRole('button', { name: 'Stop sharing', exact: true }).click();
    await expect(summary(page)).toContainText(/sees nothing/i);
    await expect(page.getByRole('button', { name: /^Stop sharing with/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(summary(page)).not.toContainText(/sees nothing/i);
    expect(await summary(page).innerText()).toBe(before);
  });

  test('Keep sharing leaves everything as it was', async ({ page }) => {
    const before = await summary(page).innerText();
    await page.getByRole('button', { name: /^Stop sharing with/ }).click();
    await page.getByRole('button', { name: 'Keep sharing' }).click();
    await expect(page.getByText('Step 1 of 2')).toHaveCount(0);
    expect(await summary(page).innerText()).toBe(before);
  });
});

test.describe('My trainer: one way into sharing', () => {
  test('one action (Chat) on the card; Privacy and sharing is the only entry and it opens the list', async ({
    page,
    baseURL,
  }) => {
    const errors = collectConsoleErrors(page);
    await openAs(page, baseURL!, '#/trainer');
    await expect(page.getByRole('button', { name: 'Chat', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('.cc-hero-b button')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Sharing settings' })).toHaveCount(0);
    await page.getByRole('button', { name: /^Privacy and sharing/ }).click();
    await expect(row(page, 'Workout totals')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a migrated trainer: the note has no button of its own', async ({ page, baseURL }) => {
    await openAs(page, baseURL!, '#/trainer', 'en', 'migrated');
    await expect(page.getByText(/was already your trainer in Spotter/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Sharing settings' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Privacy and sharing/ })).toBeVisible();
  });

  test('no "Personal trainer at" line without a gym name', async ({ page, baseURL }) => {
    await openAs(page, baseURL!, '#/trainer');
    await page.waitForSelector('.cc-hero', { timeout: 15_000 });
    // the sample trainer has a gym, the line must read as a whole sentence, never end in "at"
    const lines = await page.locator('.cc-hero-t span').allTextContents();
    for (const l of lines) expect(l.trim()).not.toMatch(/ at\s*$/);
  });
});

for (const locale of LOCALES) {
  for (const width of [320, 390, 1440]) {
    test(`geometry ${locale} @${width}: no horizontal scroll, touch targets >= 44 px, rows not clipped, named controls`, async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await openAs(page, baseURL!, PRIVACY, locale);
      await page.waitForSelector('button.uirow', { timeout: 15_000 });
      await page.waitForTimeout(500);
      expect(await horizontalOverflow(page), `overflow ${locale}@${width}`).toBe(0);
      expect(await unnamedControls(page)).toEqual([]);
      const bad = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('button.uirow')]
          .filter((b) => b.offsetParent !== null)
          .flatMap((b) => {
            const out: string[] = [];
            const r = b.getBoundingClientRect();
            if (r.height < 44)
              out.push(`short ${Math.round(r.height)}px: ${b.textContent?.slice(0, 30)}`);
            for (const el of b.querySelectorAll<HTMLElement>('.uirow-l, .uirow-s, .uirow-v'))
              if (el.scrollWidth > el.clientWidth + 1)
                out.push(`clipped: ${el.textContent?.slice(0, 30)}`);
            return out;
          }),
      );
      expect(bad).toEqual([]);
    });
  }
}
