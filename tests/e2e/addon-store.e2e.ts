/**
 * SPO-500 / SPO-513: the Add-on Store in the production build, for each role (member, trainer, admin). A returning
 * account (nothing leaves localhost, nothing is written to the backend) opens the store, sees what its role is offered,
 * searches, picks an item, installs it, finds it under Installed, manages it and removes it again. Roles see different
 * catalogs and different starter packs; nobody sees another role's items.
 *
 * Needs a built client (see helpers/layout-shift.ts: E2E_TODAY_URL / E2E_TODAY_DIST). Run:
 * `npx playwright test tests/e2e/addon-store.e2e.ts --project=mobile-chromium`.
 */
import { expect, test, type Page } from '@playwright/test';
import { arm, makeHarness, passProfileGate, type Stub } from './helpers/layout-shift';

const harness = makeHarness(4178);
const BASE = harness.base;

test.beforeAll(async () => {
  await harness.start();
});
test.afterAll(() => {
  harness.stop();
});

const CONSENT_VERIFIED = (uid: string) =>
  JSON.stringify({ [uid]: 'terms@2026-10-21,policy-ack@2026-11-05,age-18@2026-10-21' });

type Role = 'member' | 'trainer' | 'admin';

async function openStore(page: Page, role: Role, hash = '#/store') {
  const stub: Stub = { delayMs: 0, assignment: true };
  await arm(page, stub, BASE, 'en', role);
  await page.addInitScript(
    (v) => localStorage.setItem('spotter.consentVerified', v),
    CONSENT_VERIFIED('e2e-m'),
  );
  await page.goto(BASE + '/');
  if (role === 'member') await passProfileGate(page);
  await page.goto(BASE + '/' + hash);
  await expect(page.locator('.sk-root')).toBeVisible({ timeout: 30_000 });
}

const root = (page: Page) => page.locator('.sk-root');
const storedList = (page: Page) =>
  page.evaluate(
    () =>
      (JSON.parse(localStorage.getItem('spotter.addons') ?? '{"list":[]}') as { list: string[] })
        .list,
  );

test.describe('Discover: each role is offered its own things', () => {
  test('member: Apex of the week, Recovery pack, four categories, no coach items', async ({
    page,
  }) => {
    test.setTimeout(100_000);
    await openStore(page, 'member');
    await expect(root(page)).toHaveAttribute('data-store-role', 'member');
    await expect(root(page).getByText('Apex').first()).toBeVisible();
    await expect(root(page).getByText('Recovery').first()).toBeVisible();
    await expect(root(page).getByText('4 categories')).toBeVisible();
    await expect(root(page).getByText('Coach my clients')).toHaveCount(0);
    await expect(root(page).getByText('Home workouts')).toHaveCount(0);
  });

  test('trainer: Home workouts, the coach pack with Gym, five categories, no Recovery pack', async ({
    page,
  }) => {
    test.setTimeout(100_000);
    await openStore(page, 'trainer');
    await expect(root(page)).toHaveAttribute('data-store-role', 'trainer');
    await expect(root(page).getByText('Home workouts').first()).toBeVisible();
    await expect(root(page).getByText('Coach my clients')).toBeVisible();
    await expect(root(page).getByText('Live, Notes, Gym')).toBeVisible();
    await expect(root(page).getByText('5 categories')).toBeVisible();
    await expect(root(page).getByText('Starter pack')).toBeVisible();
    await expect(root(page).getByText('Health, Sleep')).toHaveCount(0);
  });

  test('admin: the coach pack and the Team item, no member-only Apex', async ({ page }) => {
    test.setTimeout(100_000);
    await openStore(page, 'admin');
    await expect(root(page)).toHaveAttribute('data-store-role', 'admin');
    await expect(root(page).getByText('Coach my clients')).toBeVisible();
    await expect(root(page).getByText('Team').first()).toBeVisible();
    await expect(root(page).getByText('Apex')).toHaveCount(0);
  });
});

test.describe('Themes tab', () => {
  for (const role of ['member', 'trainer', 'admin'] as const) {
    test(`${role}: Cyberpunk and the one Holiday themes item are offered`, async ({ page }) => {
      test.setTimeout(100_000);
      await openStore(page, role, '#/store/themes');
      await expect(root(page).getByText('Cyberpunk').first()).toBeVisible();
      await expect(root(page).getByText('Holiday themes').first()).toBeVisible();
      await expect(root(page).getByText('Halloween')).toHaveCount(0); // one item, not one per holiday
    });
  }
});

test.describe('search', () => {
  test('finds an item by name, says so when there is nothing, and Cancel goes back', async ({
    page,
  }) => {
    test.setTimeout(100_000);
    await openStore(page, 'member', '#/store/apps');
    await page.getByPlaceholder('Search apps and add-ons').first().click();
    await expect(page).toHaveURL(/\/store\/search$/);
    await page.getByPlaceholder('Search apps and add-ons').first().fill('sleep');
    await expect(root(page).getByText('Sleep').first()).toBeVisible();
    await page.getByPlaceholder('Search apps and add-ons').first().fill('zzzz');
    await expect(root(page).getByText(/Nothing for/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/store\/apps$/);
  });
});

test.describe('pick, install, manage, remove (nothing is written to the backend)', () => {
  // a member installs an add-on of the Gym base; a trainer and an admin install Gym itself (it is theirs to add)
  const PICK = {
    member: ['atlas', 'Atlas'],
    trainer: ['gym', 'Gym'],
    admin: ['gym', 'Gym'],
  } as const;
  for (const role of ['member', 'trainer', 'admin'] as const) {
    const [id, name] = PICK[role];
    test(`${role}: ${name} goes Add → Selected → Install → All set → Installed → Remove`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await openStore(page, role, `#/store/item/${id}`);
      await root(page)
        .getByRole('button', { name: /^Add$|^Add with/ })
        .first()
        .click();
      await page.goto(BASE + '/#/store/selected');
      await root(page)
        .getByRole('button', { name: /Install 1 item/ })
        .first()
        .click();
      await expect(page).toHaveURL(/\/store\/done$/, { timeout: 20_000 });
      await expect(root(page).getByText('All set')).toBeVisible();
      expect(await storedList(page)).toContain(id);

      await page.goto(BASE + '/#/store/installed');
      await expect(root(page).getByText(name).first()).toBeVisible();
      await expect(root(page).getByText('Only the base so far')).toHaveCount(0);

      await page.goto(BASE + `/#/store/manage/${id}`);
      await root(page)
        .getByRole('button', { name: `Remove ${name}` })
        .click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByText(/Your entries stay saved/)).toBeVisible();
      await sheet.getByRole('button', { name: 'Remove' }).click();
      await expect(page).toHaveURL(/\/store\/installed$/);
      expect(await storedList(page)).not.toContain(id);
      await expect(root(page).getByText('Only the base so far')).toBeVisible();
    });
  }

  test('Cancel in the remove sheet changes nothing', async ({ page }) => {
    test.setTimeout(100_000);
    await openStore(page, 'member', '#/store/item/atlas');
    await root(page)
      .getByRole('button', { name: /^Add$|^Add with/ })
      .first()
      .click();
    await page.goto(BASE + '/#/store/selected');
    await root(page)
      .getByRole('button', { name: /Install 1 item/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/store\/done$/, { timeout: 20_000 });
    await page.goto(BASE + '/#/store/manage/atlas');
    await root(page).getByRole('button', { name: 'Remove Atlas' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    expect(await storedList(page)).toContain('atlas');
  });

  test('Undo on All set puts the item back in Selected', async ({ page }) => {
    test.setTimeout(100_000);
    await openStore(page, 'member', '#/store/item/atlas');
    await root(page)
      .getByRole('button', { name: /^Add$|^Add with/ })
      .first()
      .click();
    await page.goto(BASE + '/#/store/selected');
    await root(page)
      .getByRole('button', { name: /Install 1 item/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/store\/done$/, { timeout: 20_000 });
    await root(page).getByRole('button', { name: 'Undo' }).click();
    await expect(page).toHaveURL(/\/store\/selected$/);
    expect(await storedList(page)).not.toContain('atlas');
  });
});

test.describe('role gates and coming soon', () => {
  test('a coach-only item is not reachable for a member (its page falls back, no add action)', async ({
    page,
  }) => {
    test.setTimeout(100_000);
    await openStore(page, 'member', '#/store/item/gym');
    await expect(root(page).getByRole('button', { name: /^Add$|^Add with/ })).toHaveCount(0);
  });

  test('coming soon: no add action', async ({ page }) => {
    test.setTimeout(100_000);
    await openStore(page, 'member', '#/store/item/music');
    await expect(root(page).getByText('Not available yet.')).toBeVisible();
    await expect(root(page).getByRole('button', { name: /^Add$|^Add with/ })).toHaveCount(0);
  });

  test('offline: the bar says so and adding is replaced by a disabled Offline pill', async ({
    page,
    context,
  }) => {
    test.setTimeout(100_000);
    await openStore(page, 'member');
    await context.setOffline(true);
    await expect(root(page).getByText('You are offline.')).toBeVisible();
    await expect(root(page).getByRole('button', { name: 'Offline' }).first()).toBeDisabled();
  });

  test('Back to Spotter leaves the store for Today', async ({ page }) => {
    test.setTimeout(100_000);
    await openStore(page, 'member');
    await page.getByRole('button', { name: 'Back to Spotter' }).first().click();
    await expect(page).toHaveURL(/\/today$/);
  });
});
