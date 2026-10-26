import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isGymLike,
  plainCreditText,
  resolvePhoto,
  resolvePhotoInfo,
  searchNearbyGyms,
  searchNearbyGymsMerged,
  type PlaceResult,
} from './gymProviders';
import { resetGeoGateForTests, setGeoSearchState } from './geoSearchGate';

/** SPO-341: which image a gym gets (photo → logo → nothing), what is asked of providers, and the nearby merge. */

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let routes: [string, Handler][] = [];
const calls: { url: string; init?: RequestInit }[] = [];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const on = (part: string, h: Handler) => routes.push([part, h]);
const ctl = () => new AbortController();
const MOKOTOW = { lat: 52.19, lng: 21.0 };
const row = (extra: Partial<PlaceResult> = {}): PlaceResult => ({
  key: 'k',
  name: 'Zdrofit',
  lat: MOKOTOW.lat,
  lng: MOKOTOW.lng,
  sources: ['osm'],
  ...extra,
});

const commonsAnswer = (extmetadata?: Record<string, { value: string }>) =>
  json({
    query: {
      pages: {
        1: {
          imageinfo: [
            {
              thumburl: 'https://upload.wikimedia.org/t/venue.jpg',
              descriptionurl: 'https://commons.wikimedia.org/wiki/File:Venue.jpg',
              extmetadata,
            },
          ],
        },
      },
    },
  });

beforeEach(() => {
  resetGeoGateForTests();
  setGeoSearchState({ on: true, ready: true, answered: true });
  localStorage.clear();
  routes = [];
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const r = routes.find(([p]) => String(url).includes(p));
      if (!r) throw new Error(`unrouted ${url}`);
      return r[1](String(url), init);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('which image a gym gets', () => {
  it('a venue photo URL wins and nothing is asked of any service', async () => {
    const photo = await resolvePhotoInfo(row({ photoUrl: 'https://x/p.jpg' }), ctl().signal);
    expect(photo).toEqual({ url: 'https://x/p.jpg' });
    expect(calls).toHaveLength(0);
  });

  it("the venue's own Wikidata image (P18) comes before its Commons tag and the brand logo", async () => {
    on('wbgetclaims', (url) => {
      expect(url).toContain('entity=Q100');
      expect(url).toContain('property=P18');
      return json({ claims: { P18: [{ mainsnak: { datavalue: { value: 'Venue.jpg' } } }] } });
    });
    on('commons.wikimedia.org', () => commonsAnswer());
    const photo = await resolvePhotoInfo(
      row({ venueWikidata: 'Q100', wikimediaCommons: 'File:Other.jpg', brandWikidata: 'Q5' }),
      ctl().signal,
    );
    expect(photo?.url).toBe('https://upload.wikimedia.org/t/venue.jpg');
    expect(calls.some((c) => c.url.includes('titles=File%3AOther.jpg'))).toBe(false);
  });

  it('a Commons Category tag is not an image: skipped without a request, the next source is tried', async () => {
    on('wbgetclaims', () =>
      json({ claims: { P154: [{ mainsnak: { datavalue: { value: 'Logo.svg' } } }] } }),
    );
    on('commons.wikimedia.org', () => commonsAnswer());
    const photo = await resolvePhotoInfo(
      row({ wikimediaCommons: 'Category:Zdrofit', brandWikidata: 'Q5' }),
      ctl().signal,
    );
    expect(photo?.url).toBe('https://upload.wikimedia.org/t/venue.jpg');
    expect(calls.some((c) => c.url.includes('Category'))).toBe(false);
  });

  it('nothing found anywhere is null (the UI then shows the local graphic, not a map)', async () => {
    on('wbsearchentities', () => json({ search: [] }));
    expect(await resolvePhoto(row(), ctl().signal)).toBeNull();
    expect(calls.some((c) => c.url.includes('tile.openstreetmap.org'))).toBe(false);
  });

  it('a provider that errors out gives null, not an exception', async () => {
    on('commons.wikimedia.org', () => json({}, 500));
    on('wbsearchentities', () => json({}, 500));
    expect(await resolvePhoto(row({ wikimediaCommons: 'File:A.jpg' }), ctl().signal)).toBeNull();
  });

  it('a Commons answer without any image info is null, not a broken url', async () => {
    on('commons.wikimedia.org', () => json({ query: { pages: { '-1': { missing: '' } } } }));
    on('wbsearchentities', () => json({ search: [] }));
    expect(await resolvePhoto(row({ wikimediaCommons: 'File:Gone.jpg' }), ctl().signal)).toBeNull();
  });
});

describe('attribution', () => {
  it('carries author, licence and the image page from Commons metadata', async () => {
    on('commons.wikimedia.org', () =>
      commonsAnswer({
        Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Jan">Jan K.</a>' },
        LicenseShortName: { value: 'CC BY-SA 4.0' },
        LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
      }),
    );
    const photo = await resolvePhotoInfo(row({ wikimediaCommons: 'File:Venue.jpg' }), ctl().signal);
    expect(photo?.credit).toEqual({
      author: 'Jan K.',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      pageUrl: 'https://commons.wikimedia.org/wiki/File:Venue.jpg',
    });
    const asked = calls[0].url;
    expect(asked).toContain('extmetadata');
  });

  it('plainCreditText strips markup, decodes entities and shortens', () => {
    expect(plainCreditText('<b>A &amp; B</b>')).toBe('A & B');
    expect(plainCreditText(undefined)).toBeUndefined();
    expect(plainCreditText('<br/>')).toBeUndefined();
    expect(plainCreditText('x'.repeat(100), 10)).toBe('xxxxxxxxx…');
  });

  it('the logo credit survives the 30-day cache', async () => {
    on('wbsearchentities', () => json({ search: [{ id: 'Q7' }] }));
    on('wbgetclaims', () =>
      json({ claims: { P154: [{ mainsnak: { datavalue: { value: 'Logo.svg' } } }] } }),
    );
    on('commons.wikimedia.org', () => commonsAnswer({ LicenseShortName: { value: 'PD' } }));
    const first = await resolvePhotoInfo(row({ name: 'Brand X' }), ctl().signal);
    const before = calls.length;
    const second = await resolvePhotoInfo(row({ name: 'Brand X' }), ctl().signal);
    expect(calls).toHaveLength(before);
    expect(second).toEqual(first);
    expect(second?.credit?.license).toBe('PD');
  });
});

describe('what leaves the device (SPO-341: no user data to the image providers)', () => {
  it('image lookups name only the file / entity / brand, never a position or an identifier of the person', async () => {
    on('wbsearchentities', () => json({ search: [{ id: 'Q7' }] }));
    on('wbgetclaims', () => json({ claims: {} }));
    on('commons.wikimedia.org', () => commonsAnswer());
    await resolvePhotoInfo(
      row({ venueWikidata: 'Q100', wikimediaCommons: 'File:V.jpg', name: 'Zdrofit' }),
      ctl().signal,
    );
    for (const c of calls) {
      const u = new URL(c.url);
      expect(['www.wikidata.org', 'commons.wikimedia.org']).toContain(u.host);
      const q = u.search.toLowerCase();
      expect(q).not.toContain(String(MOKOTOW.lat));
      expect(q).not.toContain(String(MOKOTOW.lng));
      expect(c.init?.headers ?? {}).not.toHaveProperty('Authorization');
    }
  });

  it('with no consent not one request is made', async () => {
    resetGeoGateForTests();
    expect(
      await resolvePhotoInfo(row({ wikimediaCommons: 'File:V.jpg' }), ctl().signal),
    ).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe('Overpass nearby query and parsing (SPO-360)', () => {
  const el = (id: number, tags: Record<string, string>, lat = 52.1901, lon = 21.0001) => ({
    type: 'node',
    id,
    lat,
    lon,
    tags,
  });

  it('asks for every gym tag (leisure, amenity, sport lists) and a cap that does not drop the nearest', async () => {
    on('overpass', () => json({ elements: [] }));
    await searchNearbyGyms(MOKOTOW, 3000, [], ctl().signal);
    const sent = String((calls[0].init!.body as URLSearchParams).get('data'));
    expect(sent).toContain('fitness_centre|sports_centre');
    expect(sent).toContain('"amenity"="gym"');
    expect(sent).toContain('crossfit');
    expect(sent).toContain('(^|;)'); // `sport=fitness;yoga` lists match
    expect(sent).toMatch(/out center tags 300;/);
    expect(sent).not.toContain('["name"]'); // brand/operator-only venues are not filtered out server-side
  });

  it('names a venue by brand or operator when it has no name, and drops one with none of them', async () => {
    on('overpass', () =>
      json({
        elements: [
          el(1, { leisure: 'fitness_centre', brand: 'Zdrofit' }),
          el(2, { leisure: 'fitness_centre', operator: 'CityFit' }),
          el(3, { leisure: 'fitness_centre' }),
        ],
      }),
    );
    const out = await searchNearbyGyms(MOKOTOW, 3000, [], ctl().signal);
    expect(out.map((p) => p.name).sort()).toEqual(['CityFit', 'Zdrofit']);
  });

  it("keeps the venue's wikidata QID for its photo", async () => {
    on('overpass', () =>
      json({ elements: [el(1, { name: 'A', leisure: 'fitness_centre', wikidata: 'Q42' })] }),
    );
    const out = await searchNearbyGyms(MOKOTOW, 3000, [], ctl().signal);
    expect(out[0].venueWikidata).toBe('Q42');
  });

  it('leaves out pools and stadiums tagged as sports centres, keeps gym sports and untagged ones', () => {
    expect(isGymLike({ leisure: 'sports_centre', sport: 'swimming' })).toBe(false);
    expect(isGymLike({ leisure: 'sports_centre', sport: 'tennis;swimming' })).toBe(false);
    expect(isGymLike({ leisure: 'sports_centre', sport: 'fitness;yoga' })).toBe(true);
    expect(isGymLike({ leisure: 'sports_centre' })).toBe(true);
    expect(isGymLike({ amenity: 'gym', sport: 'swimming' })).toBe(true);
    expect(isGymLike({ leisure: 'fitness_centre' })).toBe(true);
    expect(isGymLike(undefined)).toBe(true);
  });

  it('retries once after a 429/5xx and then returns the venues', async () => {
    let n = 0;
    on('overpass', () =>
      ++n === 1
        ? json({}, 429)
        : json({ elements: [el(1, { name: 'Retry Gym', leisure: 'fitness_centre' })] }),
    );
    const out = await searchNearbyGyms(MOKOTOW, 3000, [], ctl().signal);
    expect(n).toBe(2);
    expect(out.map((p) => p.name)).toEqual(['Retry Gym']);
  });

  it('gives up after the retries (Overpass overloaded)', async () => {
    on('overpass', () => json({}, 504));
    await expect(searchNearbyGyms(MOKOTOW, 3000, [], ctl().signal)).rejects.toThrow('overpass 504');
    expect(calls).toHaveLength(4);
  });

  it('an abort during the wait before the retry stops it', async () => {
    on('overpass', () => json({}, 503));
    const ac = ctl();
    const p = searchNearbyGyms(MOKOTOW, 3000, [], ac.signal);
    setTimeout(() => ac.abort(), 50);
    await expect(p).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });
});

describe('searchNearbyGymsMerged (Overpass + Photon)', () => {
  const photon = (names: Array<[string, number, number, string, number]>) =>
    json({
      features: names.map(([name, lat, lng, type, id]) => ({
        geometry: { coordinates: [lng, lat] },
        properties: { name, osm_type: type, osm_id: id },
      })),
    });
  const overpass = (items: Array<[string, number, number, number]>) =>
    json({
      elements: items.map(([name, lat, lon, id]) => ({
        type: 'node',
        id,
        lat,
        lon,
        tags: { name, leisure: 'fitness_centre' },
      })),
    });

  it('merges both sources, one row per venue (OSM type names agree), nearest first, within the radius', async () => {
    on('overpass', () => overpass([['Zdrofit Mokotów', 52.1905, 21.0, 11]]));
    on('photon', () =>
      photon([
        ['Zdrofit Mokotów', 52.1905, 21.0, 'N', 11], // the same venue: Photon calls the type N
        ['Fitness Club Mokotów', 52.1901, 21.0, 'N', 12],
        ['Too Far Gym', 52.4, 21.0, 'N', 13],
      ]),
    );
    const seen: number[] = [];
    const out = await searchNearbyGymsMerged(MOKOTOW, 3000, 'gym', [], ctl().signal, (m) =>
      seen.push(m.length),
    );
    expect(out.map((p) => p.name)).toEqual(['Fitness Club Mokotów', 'Zdrofit Mokotów']);
    expect(out[1].sources.sort()).toEqual(['osm', 'overpass']);
    expect(seen.length).toBeGreaterThanOrEqual(2); // streamed as each source answered
  });

  it('Overpass failing still shows the Photon venues, and the other way round', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    on('overpass', () => json({}, 500));
    on('photon', () => photon([['Only Photon', 52.1901, 21.0, 'W', 5]]));
    let out = await searchNearbyGymsMerged(MOKOTOW, 3000, 'gym', [], ctl().signal, () => undefined);
    expect(out.map((p) => p.name)).toEqual(['Only Photon']);
    expect(warn).toHaveBeenCalled();

    routes = [];
    on('overpass', () => overpass([['Only Overpass', 52.1901, 21.0, 6]]));
    on('photon', () => json({}, 500));
    out = await searchNearbyGymsMerged(MOKOTOW, 3000, 'gym', [], ctl().signal, () => undefined);
    expect(out.map((p) => p.name)).toEqual(['Only Overpass']);
  });

  it('with no consent: saved gyms only, no request', async () => {
    resetGeoGateForTests();
    const out = await searchNearbyGymsMerged(
      MOKOTOW,
      3000,
      'gym',
      [{ id: 'g', name: 'Mine', lat: 52.1901, lng: 21.0, radiusM: 50 } as never],
      ctl().signal,
      () => undefined,
    );
    expect(out.map((p) => p.name)).toEqual(['Mine']);
    expect(calls).toHaveLength(0);
  });
});
