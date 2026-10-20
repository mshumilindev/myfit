/**
 * SPO-141: People is the admin-only Users app; Me is a separate screen for every role.
 * Runs against the fixtures production build (see coach-helpers.ts): no Firebase, nothing is written anywhere.
 * Per role (member / trainer / admin): the app switcher tile, a typed /people/users and /people/clients URL, the way
 * to the own account (avatar -> Profile), the nav of each screen, and Back. Console must stay clean.
 */
import { expect, test, type Page } from '@playwright/test';
import { collectConsoleErrors as rawErrors } from './coach-helpers';

/** The fixtures run is offline on purpose: Firestore's own "could not reach backend" notice is expected noise. */
const collectConsoleErrors = (page: Page) => {
  const all = rawErrors(page);
  return {
    get length() {
      return this.list.length;
    },
    get list() {
      return all.filter((e) => !/Could not reach Cloud Firestore backend/.test(e));
    },
  };
};

type Role = 'member' | 'trainer' | 'admin';
// The service worker only adds cache noise to a fresh-URL check.
test.use({ serviceWorkers: 'block' });
const SHOTS = process.env.SHOTS_DIR ?? 'test-results/spo141';

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

async function apiKey(page: Page, origin: string): Promise<string> {
  const html = await (await page.request.get(origin + '/')).text();
  for (const m of html.matchAll(/src="([^"]*\.js)"/g)) {
    const js = await (await page.request.get(new URL(m[1], origin + '/').toString())).text();
    const k = js.match(/AIza[0-9A-Za-z_-]{35}/);
    if (k) return k[0];
  }
  return 'e2e-api-key';
}

async function seedRole(page: Page, origin: string, role: Role) {
  const key = await apiKey(page, origin);
  const now = Math.floor(Date.now() / 1000);
  const uid = `e2e-${role}`;
  const jwt = [
    b64url({ alg: 'none', typ: 'JWT' }),
    b64url({
      iss: 'e2e',
      aud: 'e2e',
      sub: uid,
      user_id: uid,
      role,
      iat: now,
      exp: now + 86_400 * 30,
    }),
    'sig',
  ].join('.');
  await page.addInitScript(
    ({ key, jwt, uid, role }) => {
      localStorage.setItem('gym.locale', 'en');
      localStorage.setItem('spotter.uid', uid);
      localStorage.setItem('spotter.role', role);
      localStorage.setItem('spotter.username', 'Iryna Melnyk');
      localStorage.setItem('gym.flags.global', JSON.stringify({ coach: true }));
      // A member with no height/weight is held by the profile-completion gate (by design); give the fixtures one.
      localStorage.setItem(
        'spotter.body',
        JSON.stringify({
          heightCm: 178,
          weights: [{ id: 'w1', at: Date.now() - 86_400_000, weight: 84 }],
        }),
      );
      localStorage.setItem(
        `firebase:authUser:${key}:[DEFAULT]`,
        JSON.stringify({
          uid,
          email: null,
          emailVerified: false,
          isAnonymous: false,
          providerData: [],
          stsTokenManager: {
            refreshToken: 'e2e-refresh',
            accessToken: jwt,
            expirationTime: Date.now() + 30 * 86_400_000,
          },
          createdAt: String(Date.now()),
          lastLoginAt: String(Date.now()),
          apiKey: key,
          appName: '[DEFAULT]',
        }),
      );
    },
    { key, jwt, uid, role },
  );
  // Nothing leaves the machine. Requests HANG instead of failing: an aborted Firestore read would end the first sync
  // and a member without profile data would meet the profile-completion gate (by design), which has nothing to do
  // with who may open People.
  await page.route(
    (url) => !['127.0.0.1', 'localhost'].includes(url.hostname),
    (r) =>
      /firestore|firebase|googleapis|cloudfunctions|run\.app/.test(
        new URL(r.request().url()).hostname,
      )
        ? new Promise<void>(() => undefined)
        : r.abort('blockedbyclient'),
  );
}

async function openProfile(page: Page) {
  await page.getByRole('button', { name: 'Profile and mode' }).first().click();
  const profile = page.getByRole('button', { name: 'Profile', exact: true }).first();
  await profile.waitFor({ state: 'visible' });
  await page.waitForTimeout(800); // the sheet slides up
  await profile.evaluate((el) => (el as HTMLElement).click());
}
const path = (page: Page) => new URL(page.url()).pathname;
async function shot(page: Page, role: Role, name: string, info: { project: { name: string } }) {
  await page.screenshot({
    path: `${SHOTS}/${info.project.name}-${role}-${name}.png`,
  });
}
/** Open the app switcher: the header app button on a phone, the rail's Apps button on desktop. */
async function openSwitcher(page: Page) {
  await page
    .getByRole('button', { name: /^Switch app$|^Apps$/ })
    .first()
    .click();
  await expect(page.locator('.shell-sheet')).toBeVisible();
}
const usersTile = (page: Page) => page.locator('.shell-sheet .shell-tile', { hasText: /^Users/ });

for (const role of ['member', 'trainer', 'admin'] as const) {
  test.describe(`SPO-141 as ${role}`, () => {
    test.beforeEach(async ({ page, baseURL }) => {
      await seedRole(page, baseURL!, role);
    });

    test('AC1: the Users tile is in the app switcher for an admin only', async ({ page }, info) => {
      const errors = collectConsoleErrors(page);
      await page.goto('/today', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#root *');
      await openSwitcher(page);
      await page.waitForTimeout(300);
      if (role === 'admin') await expect(usersTile(page)).toHaveCount(1);
      else await expect(usersTile(page)).toHaveCount(0);
      // the old per-role labels are gone too
      await expect(
        page.locator('.shell-sheet .shell-tile', {
          hasText: /Clients|Your profile/,
        }),
      ).toHaveCount(0);
      await shot(page, role, 'ac1-switcher', info);
      expect(errors.list).toEqual([]);
    });

    test('AC2: a typed /people/users never shows Users to a non-admin; /people/clients neither', async ({
      page,
    }, info) => {
      const errors = collectConsoleErrors(page);
      await page.goto('/people/users', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.app-roster', { timeout: 15_000 });
      await page.waitForTimeout(500);
      if (role === 'admin') {
        expect(path(page)).toBe('/people/users');
        await expect(page.locator('.app-roster')).toBeVisible();
      } else {
        expect(path(page)).toBe('/people/me');
      }
      await shot(page, role, 'ac2-people-users', info);
      await page.goto('/people/clients', { waitUntil: 'domcontentloaded' });
      // a retired Clients bookmark: staff land on Coach clients, a member on Me; nobody on /people/clients
      await page.waitForTimeout(800);
      expect(path(page)).toBe(role === 'member' ? '/people/me' : '/c/clients');
      await shot(page, role, 'ac2-people-clients', info);
      expect(errors.list).toEqual([]);
    });

    test('AC4: the own account opens from the avatar in Gym (profile screen) with no Users anywhere', async ({
      page,
    }, info) => {
      const errors = collectConsoleErrors(page);
      await page.goto('/today', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#root *');
      await openProfile(page);
      await page.waitForTimeout(800);
      expect(path(page)).toBe('/profile/me');
      await expect(page.getByText(/^Users$/)).toHaveCount(0);
      await shot(page, role, 'ac4-gym-profile', info);
      expect(errors.list).toEqual([]);
    });

    test('AC4/AC5: from another app the avatar opens Me in the People chrome; Me and Users never share a nav', async ({
      page,
    }, info) => {
      const errors = collectConsoleErrors(page);
      await page.goto('/apex', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#root *');
      await openProfile(page);
      await page.waitForSelector('.app-roster');
      await page.waitForTimeout(500);
      expect(path(page)).toBe('/people/me');
      const navItems = async () =>
        (
          await page
            .locator(
              '.app-roster .rail-nav .rail-item, .app-roster nav button, .app-roster [role=tab]',
            )
            .allInnerTexts()
        )
          .map((x) => x.trim())
          .filter((x) => /^(Me|Users|Clients)$/.test(x));
      const meNav = await navItems();
      expect(meNav, 'nav of the Me screen').not.toContain('Users');
      expect(meNav).not.toContain('Clients');
      await shot(page, role, 'ac4-me', info);
      if (role === 'admin') {
        await page.goto('/people/users', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.app-roster');
        await page.waitForTimeout(500);
        expect(path(page)).toBe('/people/users');
        const usersNav = await navItems();
        expect(usersNav, 'nav of the Users screen').not.toContain('Me');
        await shot(page, role, 'ac5-users', info);
      }
      expect(errors.list).toEqual([]);
    });

    test('AC4/AC6: trainer and admin reach their clients through Coach (the old People/Clients is gone), a member has no Coach', async ({
      page,
    }, info) => {
      await page.goto('/today', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#root *');
      await openSwitcher(page);
      const coach = page.locator('.shell-sheet .shell-tile', {
        hasText: /^Coach/,
      });
      if (role === 'member') {
        await expect(coach).toHaveCount(0);
        return;
      }
      await expect(coach).toHaveCount(1);
      await coach.click();
      await page.waitForTimeout(1200);
      expect(path(page)).toMatch(/^\/c\//);
      await page.goto('/c/clients', { waitUntil: 'domcontentloaded' });
      // The Coach shell opens on Clients with its own Clients nav item (the client data itself is not loadable offline).
      await expect(
        page
          .getByRole('link', { name: /^Clients/ })
          .or(page.getByRole('button', { name: /^Clients/ }))
          .first(),
      ).toBeVisible({ timeout: 15_000 });
      expect(path(page)).toBe('/c/clients');
      await shot(page, role, 'ac6-coach-clients', info);
    });

    test('an admin gets from Me to Users through the app switcher; a retired Clients hash typed in a running app lands on Coach (staff) or Me (member)', async ({
      page,
    }, info) => {
      await page.goto('/people/me', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.app-roster');
      if (role === 'admin') {
        await openSwitcher(page);
        await usersTile(page).click();
        await page.waitForTimeout(800);
        expect(path(page)).toBe('/people/users');
        await shot(page, role, 'admin-me-to-users', info);
      }
      await page.goto('/today', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#root *');
      await page.evaluate(() => {
        window.location.hash = '#/people/clients';
      });
      await page.waitForTimeout(1000);
      expect(path(page)).toBe(role === 'member' ? '/people/me' : '/c/clients');
    });

    test('AC8: in-app Back from the Gym profile returns to Today; People Me is an app root left through Apps', async ({
      page,
    }, info) => {
      await page.goto('/today', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#root *');
      await openProfile(page);
      await page.waitForTimeout(800);
      expect(path(page)).toBe('/profile/me');
      await page
        .getByRole('button', { name: /^Back$/ })
        .first()
        .click();
      await page.waitForTimeout(800);
      expect(path(page)).toBe('/today');
      await shot(page, role, 'ac8-back-gym', info);
      await page.goto('/apex', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#root *');
      await openProfile(page);
      await page.waitForSelector('.app-roster');
      expect(path(page)).toBe('/people/me');
      await openSwitcher(page);
      await page.locator('.shell-sheet .shell-tile', { hasText: /^Gym/ }).click();
      await page.waitForTimeout(800);
      expect(path(page)).toBe('/today');
      await shot(page, role, 'ac8-back-people', info);
    });
  });
}
