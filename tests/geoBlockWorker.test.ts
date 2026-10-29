/**
 * SPO-184 / SPO-220 / SPO-221: the edge country block (edge/geo-block). The Worker itself cannot be run against a
 * real foreign IP here, so these tests pin the decision and the answer: who is refused, who is not, what a client
 * cannot influence, and what the refusal page looks like.
 */
import { describe, expect, it, vi } from 'vitest';
import { BLOCK_LOCALES, blockPageHtml, pickLocale } from '../edge/geo-block/src/blockPage';
import { DEFAULT_BLOCKED_COUNTRIES, parseCountries } from '../edge/geo-block/src/config';
import { inPolygon, parseAreas } from '../edge/geo-block/src/polygon';
import worker, { blockedResponse, decide, handle } from '../edge/geo-block/src/worker';

const req = (
  init: RequestInit & { cf?: Record<string, string | null> } = {},
  url = 'https://myspotter.fit/today',
) => {
  const { cf, ...rest } = init;
  const r = new Request(url, rest);
  if (cf) Object.defineProperty(r, 'cf', { value: cf });
  return r;
};
const origin = () =>
  vi.fn(async () => new Response('app', { status: 200, headers: { 'x-origin': '1' } }));

describe('who is refused', () => {
  it.each(DEFAULT_BLOCKED_COUNTRIES)(
    '%s gets 451 and never reaches the origin',
    async (country) => {
      const fromOrigin = origin();
      const res = await handle(req({ cf: { country } }), {}, fromOrigin);
      expect(res.status).toBe(451);
      expect(fromOrigin).not.toHaveBeenCalled();
    },
  );

  it.each(['PL', 'UA', 'US', 'DE'])('%s is passed to the origin untouched', async (country) => {
    const fromOrigin = origin();
    const res = await handle(req({ cf: { country } }), {}, fromOrigin);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-origin')).toBe('1');
    expect(await res.text()).toBe('app');
    expect(fromOrigin).toHaveBeenCalledTimes(1);
  });

  it('an unknown place (no cf, XX, T1, null) is let through: the block is a compliance gate, not a boundary', async () => {
    for (const cf of [undefined, { country: 'XX' }, { country: 'T1' }, { country: null }, {}]) {
      expect(decide(cf, {})).toBe('allow');
    }
  });

  it('the country is read only from request.cf: a client header cannot block or unblock anyone', async () => {
    const fromOrigin = origin();
    const spoofedAllow = await handle(
      req({
        cf: { country: 'RU' },
        headers: {
          'cf-ipcountry': 'PL',
          'x-appengine-country': 'PL',
          'x-forwarded-for': '8.8.8.8',
        },
      }),
      {},
      fromOrigin,
    );
    expect(spoofedAllow.status).toBe(451);
    const spoofedBlock = await handle(
      req({ cf: { country: 'PL' }, headers: { 'cf-ipcountry': 'RU' } }),
      {},
      fromOrigin,
    );
    expect(spoofedBlock.status).toBe(200);
  });

  it('a failing origin is passed through, not turned into a block', async () => {
    const res = await handle(
      req({ cf: { country: 'PL' } }),
      {},
      async () => new Response('down', { status: 502 }),
    );
    expect(res.status).toBe(502);
  });

  it('the default export serves through fetch()', () => {
    expect(typeof worker.fetch).toBe('function');
  });
});

describe('the list is configuration', () => {
  it('reads comma / space separated codes in any case and drops anything that is not a country code', () => {
    expect([...parseCountries(' ru, by ;kp  ir ,xx1,,u,TOOLONG')].sort()).toEqual([
      'BY',
      'IR',
      'KP',
      'RU',
    ]);
    expect([...parseCountries('pl')]).toEqual(['PL']);
  });

  it('a missing, blank or unreadable value falls back to the default list instead of switching the block off', () => {
    for (const raw of [undefined, '', '   ', ',,,', 'abc, 12']) {
      expect([...parseCountries(raw)].sort()).toEqual(['BY', 'IR', 'KP', 'RU']);
    }
  });

  it('a custom list replaces the default', () => {
    expect(decide({ country: 'PL' }, { BLOCKED_COUNTRIES: 'PL' })).toBe('country');
    expect(decide({ country: 'RU' }, { BLOCKED_COUNTRIES: 'PL' })).toBe('allow');
  });
});

describe('the refusal', () => {
  it('is a 451 page with no redirect, no script, no link, not cacheable and not indexable', async () => {
    const res = blockedResponse(req({ cf: { country: 'RU' } }));
    const html = await res.text();
    expect(res.status).toBe(451);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(res.headers.get('content-type')).toMatch(/^text\/html/);
    expect(html).not.toMatch(/<script|http-equiv|<a\s|<link|<img|window\.location/i);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it.each(BLOCK_LOCALES)('%s: lang attribute, one h1, title, readable main landmark', (locale) => {
    const html = blockPageHtml(locale);
    expect(html).toContain(`<html lang="${locale}">`);
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toContain('<main>');
    expect(html).toContain('width=device-width');
  });

  it('the five locales read differently', () => {
    const titles = new Set(
      BLOCK_LOCALES.map((l) => /<h1>([^<]+)<\/h1>/.exec(blockPageHtml(l))?.[1]),
    );
    expect(titles.size).toBe(5);
  });

  it('picks the language by Accept-Language quality; English when nothing matches (also Russian)', () => {
    expect(pickLocale('uk-UA,uk;q=0.9,en;q=0.8')).toBe('uk');
    expect(pickLocale('ru-RU,ru;q=0.9,pl;q=0.5')).toBe('pl');
    expect(pickLocale('en;q=0.2, lt;q=0.9')).toBe('lt');
    expect(pickLocale('et-EE')).toBe('et');
    expect(pickLocale('ru-RU,ru;q=0.9')).toBe('en');
    expect(pickLocale('de;q=0, pl;q=0')).toBe('en');
    expect(pickLocale('*')).toBe('en');
    expect(pickLocale(undefined)).toBe('en');
    expect(pickLocale('')).toBe('en');
  });

  it('is answered in the visitor language', async () => {
    const res = await handle(
      req({ cf: { country: 'BY' }, headers: { 'accept-language': 'pl-PL,pl;q=0.9' } }),
      {},
      origin(),
    );
    expect(res.headers.get('content-language')).toBe('pl');
    expect(await res.text()).toContain('<html lang="pl">');
  });

  it('API-style requests get JSON, HEAD gets no body, and the status is the same', async () => {
    const json = await handle(
      req({ cf: { country: 'KP' }, headers: { accept: 'application/json' } }),
      {},
      origin(),
    );
    expect(json.status).toBe(451);
    expect(await json.json()).toEqual({ error: 'region-blocked' });
    const head = await handle(req({ cf: { country: 'IR' }, method: 'HEAD' }), {}, origin());
    expect(head.status).toBe(451);
    expect(await head.text()).toBe('');
    const post = await handle(
      req({ cf: { country: 'RU' }, method: 'POST', body: '{}' }),
      {},
      origin(),
    );
    expect(post.status).toBe(451);
  });

  it('a browser asking for HTML among other types still gets the page', async () => {
    const res = await handle(
      req({ cf: { country: 'RU' }, headers: { accept: 'text/html,application/json;q=0.9' } }),
      {},
      origin(),
    );
    expect(res.headers.get('content-type')).toMatch(/^text\/html/);
  });

  it('the same URL is refused again and again (no redirect chain, so no loop)', async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await handle(
        req({ cf: { country: 'RU' } }, 'https://myspotter.fit/'),
        {},
        origin(),
      );
      expect(res.status).toBe(451);
      expect(res.redirected).toBe(false);
    }
  });
});

// A coarse box, NOT a real boundary: it only exercises the geometry. Real areas come from OCCUPIED_GEOJSON.
const BOX = {
  type: 'Polygon',
  coordinates: [
    [
      [33, 44],
      [36, 44],
      [36, 46],
      [33, 46],
      [33, 44],
    ],
  ],
};
const WITH_HOLE = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
    [
      [4, 4],
      [6, 4],
      [6, 6],
      [4, 6],
      [4, 4],
    ],
  ],
};

describe('areas by coordinates (SPO-221 prototype)', () => {
  it('inside and outside a polygon, holes excluded', () => {
    const [box] = parseAreas(JSON.stringify(BOX));
    expect(inPolygon(34.1, 44.95, box!)).toBe(true);
    expect(inPolygon(30.5, 50.45, box!)).toBe(false);
    expect(inPolygon(32.9, 45, box!)).toBe(false);
    const [holed] = parseAreas(JSON.stringify(WITH_HOLE));
    expect(inPolygon(2, 2, holed!)).toBe(true);
    expect(inPolygon(5, 5, holed!)).toBe(false);
  });

  it('reads Feature, FeatureCollection and MultiPolygon', () => {
    const feature = { type: 'Feature', properties: {}, geometry: BOX };
    const collection = {
      type: 'FeatureCollection',
      features: [feature, { type: 'Feature', geometry: WITH_HOLE }],
    };
    const multi = { type: 'MultiPolygon', coordinates: [BOX.coordinates, WITH_HOLE.coordinates] };
    expect(parseAreas(JSON.stringify(feature))).toHaveLength(1);
    expect(parseAreas(JSON.stringify(collection))).toHaveLength(2);
    expect(parseAreas(JSON.stringify(multi))).toHaveLength(2);
  });

  it('unreadable or malformed data blocks nobody', () => {
    for (const raw of [
      undefined,
      '',
      'not json',
      '{}',
      '[]',
      'null',
      JSON.stringify({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 1],
          ],
        ],
      }),
      JSON.stringify({
        type: 'Polygon',
        coordinates: [
          [
            ['a', 1],
            [1, 1],
            [1, 2],
            ['a', 1],
          ],
        ],
      }),
    ]) {
      expect(parseAreas(raw)).toEqual([]);
    }
  });

  it('refuses a request located inside a configured area, with string coordinates as Cloudflare gives them', async () => {
    const env = { OCCUPIED_GEOJSON: JSON.stringify(BOX) };
    const fromOrigin = origin();
    const inside = await handle(
      req({ cf: { country: 'UA', latitude: '44.95', longitude: '34.10' } }),
      env,
      fromOrigin,
    );
    expect(inside.status).toBe(451);
    const outside = await handle(
      req({ cf: { country: 'UA', latitude: '50.45', longitude: '30.52' } }),
      env,
      fromOrigin,
    );
    expect(outside.status).toBe(200);
    expect(fromOrigin).toHaveBeenCalledTimes(1);
  });

  it('without a configured area, or without coordinates, nothing changes', () => {
    expect(decide({ country: 'UA', latitude: '44.95', longitude: '34.10' }, {})).toBe('allow');
    expect(decide({ country: 'UA' }, { OCCUPIED_GEOJSON: JSON.stringify(BOX) })).toBe('allow');
    expect(
      decide(
        { country: 'UA', latitude: 'x', longitude: '34' },
        { OCCUPIED_GEOJSON: JSON.stringify(BOX) },
      ),
    ).toBe('allow');
  });
});
