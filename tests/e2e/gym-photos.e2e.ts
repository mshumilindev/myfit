/**
 * SPO-341: the Gyms screen shows a photo for a nearby gym that has one, the neutral house graphic for one that has
 * none (never a map tile), and keeps rendering its rows offline.
 *
 * Everything is on localhost: the `gymPlaces` Cloud Function (nearby / search / photo) and `recordConsent` are stubbed
 * with page.route with synthetic data, every other outside host answers an empty JSON, nothing reaches a backend.
 * The gym-search consent (geo-search, version 2026-10-27) is given the way a person gives it: "Turn on" on the Gyms
 * screen, then "Search with these services" (the consent write is the stubbed `recordConsent`). The geolocation is
 * granted through the context and fixed to Warsaw.
 *
 * Needs a built client on E2E_BASE_URL (default http://127.0.0.1:4173). Run:
 * `npx playwright test tests/e2e/gym-photos.e2e.ts --project=mobile-chromium`.
 */
import { expect, test, type Page, type Route } from '@playwright/test';
import { arm, passProfileGate, type Stub } from './helpers/layout-shift';

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const CONSENT_VERIFIED = JSON.stringify({
  'e2e-m': 'terms@2026-10-21,policy-ack@2026-10-30,age-18@2026-10-21',
});
const WARSAW = { latitude: 52.19, longitude: 21.02 };

/** A 1x1 PNG: a real, decodable image the stub hands out as the "photo". */
const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const PLACES = [
  {
    id: 'e2e-a',
    name: 'Alpha Iron Club',
    lat: 52.1905,
    lng: 21.0205,
    photoName: 'places/e2e-a/photos/p1',
    photoBy: ['E2E Author'],
  },
  {
    id: 'e2e-b',
    name: 'Bravo Barbell House',
    lat: 52.1915,
    lng: 21.0215,
    photoName: 'places/e2e-b/photos/p1',
    photoBy: ['E2E Author'],
  },
  { id: 'e2e-c', name: 'Charlie Plain Gym', lat: 52.1925, lng: 21.0225 },
];

const TILE = /tile|openstreetmap|staticmap/i;
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
};

interface Seen {
  offline: boolean;
  gymPlaces: string[];
  outside: string[];
  tiles: string[];
}

/** Stubs every outside call; must be registered after `arm` (the later route wins). */
async function stubOutside(page: Page): Promise<Seen> {
  const seen: Seen = {
    offline: false,
    gymPlaces: [],
    outside: [],
    tiles: [],
  };
  const json = (route: Route, body: unknown) =>
    route
      .fulfill({
        status: 200,
        headers: { ...cors, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      .catch(() => undefined);
  await page.route(
    (url) => !['127.0.0.1', 'localhost'].includes(url.hostname),
    async (route) => {
      const req = route.request();
      const url = req.url();
      if (TILE.test(url)) seen.tiles.push(url);
      // like a real offline device: a stubbed host is unreachable too (route handlers run before the offline switch)
      if (seen.offline) return route.abort('internetdisconnected');
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (url.endsWith('/gymPlaces')) {
        const op = (req.postDataJSON() as { data?: { op?: string } } | null)?.data?.op ?? '?';
        seen.gymPlaces.push(op);
        if (op === 'nearby') return json(route, { result: { places: PLACES } });
        if (op === 'photo') return json(route, { result: { photo: PHOTO } });
        return json(route, { result: { places: [] } });
      }
      if (url.endsWith('/recordConsent'))
        return json(route, { result: { id: 'e2e-consent', at: Date.now() } });
      if (url.endsWith('/programMine')) return json(route, { result: { assignment: null } });
      if (/overpass|photon|nominatim|wikidata|wikimedia|openstreetmap/.test(url)) {
        seen.outside.push(new URL(url).hostname);
        return json(route, { elements: [], features: [], entities: {}, query: { pages: {} } });
      }
      return route.abort('blockedbyclient'); // Firestore etc.: nothing leaves the machine
    },
  );
  return seen;
}

/** The gym result rows of the nearby list, in order. */
const rows = (page: Page) => page.locator('.gym-result');
const rowOf = (page: Page, name: string) => rows(page).filter({ hasText: name });

test.use({ serviceWorkers: 'block' });

test('gyms list: photo, neutral fallback, never a map tile, works offline', async ({
  page,
  context,
}) => {
  test.setTimeout(55_000);
  await context.grantPermissions(['geolocation'], { origin: BASE });
  await context.setGeolocation(WARSAW);
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const tileImages: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'image' && TILE.test(r.url())) tileImages.push(r.url());
  });

  const stub: Stub = { delayMs: 0, assignment: false };
  await arm(page, stub, BASE, 'en');
  const seen = await stubOutside(page);
  await page.addInitScript(
    (v) => localStorage.setItem('spotter.consentVerified', v),
    CONSENT_VERIFIED,
  );
  await page.goto(BASE + '/');
  await passProfileGate(page);

  // Open the Gyms screen (client-side, so the in-memory consent survives the offline round trip below).
  await page
    .getByRole('link', { name: /^Gyms$/ })
    .or(page.getByRole('button', { name: /^Gyms$/ }))
    .first()
    .click();
  await expect(page).toHaveURL(/\/gyms/);

  // Consent, given as a person does: Turn on -> Search with these services.
  await page.getByRole('button', { name: 'Turn on' }).first().click();
  await page.getByRole('button', { name: 'Search with these services' }).click();
  await expect(page.getByRole('button', { name: 'Search with these services' })).toHaveCount(0);

  // Three nearby rows appear.
  await expect(rows(page)).toHaveCount(3);
  const photoRows = ['Alpha Iron Club', 'Bravo Barbell House'];

  // (2) rows with a photo: a real, decoded <img> from the photo source.
  for (const name of photoRows) {
    const img = rowOf(page, name).locator('.thumb img');
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute('src', PHOTO);
    await expect
      .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth))
      .toBeGreaterThan(0);
  }
  // the row without a photo: the house graphic, no <img> at all
  const plain = rowOf(page, 'Charlie Plain Gym').locator('.thumb');
  await expect(plain.locator('svg.house-graphic')).toHaveCount(1);
  await expect(plain.locator('img')).toHaveCount(0);

  // no map tile anywhere in the list, nor requested
  const listImgs = await rows(page)
    .locator('img')
    .evaluateAll((l) => l.map((i) => (i as HTMLImageElement).currentSrc));
  expect(listImgs.filter((s) => TILE.test(s))).toEqual([]);
  expect(tileImages).toEqual([]);
  expect(seen.tiles).toEqual([]);
  expect(seen.gymPlaces).toContain('nearby');
  expect(seen.gymPlaces.filter((o) => o === 'photo').length).toBeGreaterThanOrEqual(2);

  // (3) offline: leave the screen and come back; the rows are still there, with the same pictures.
  seen.offline = true;
  await context.setOffline(true);
  await page
    .getByRole('link', { name: /^Today$/ })
    .or(page.getByRole('button', { name: /^Today$/ }))
    .first()
    .click();
  await expect(page.locator('.today-page')).toBeVisible();
  await page
    .getByRole('link', { name: /^Gyms$/ })
    .or(page.getByRole('button', { name: /^Gyms$/ }))
    .first()
    .click();
  await expect(page).toHaveURL(/\/gyms/);
  await expect(rows(page)).toHaveCount(3);
  for (const name of photoRows) {
    const img = rowOf(page, name).locator('.thumb img');
    await expect
      .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth))
      .toBeGreaterThan(0);
  }
  await expect(plain.locator('svg.house-graphic')).toHaveCount(1);
  expect(tileImages).toEqual([]);
  await context.setOffline(false);
  seen.offline = false;

  // nothing but the browser's own network-failure lines (blocked Firestore, the offline round trip) in the console
  const unexpected = consoleErrors.filter(
    (l) =>
      !/Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_FAILED|ERR_BLOCKED_BY_CLIENT|Could not reach Cloud Firestore backend/.test(
        l,
      ),
  );
  expect(unexpected).toEqual([]);
  expect(pageErrors).toEqual([]);
});
