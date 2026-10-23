import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bboxAround,
  cacheAddress,
  fmtDistance,
  haversineM,
  mergeResults,
  parseOpeningHours,
  readCache,
  resolveAddress,
  searchGyms,
  searchNearbyGyms,
  staticMapThumb,
  type PlaceResult,
  type ProviderId,
  type ProviderState,
} from './gymProviders';
import { resetGeoGateForTests, setGeoSearchState } from './geoSearchGate';
import type { Gym } from '../types';

const NOW = new Date('2026-05-04T10:00:00Z').getTime();
const DAY = 86_400_000;
const KYIV = { lat: 50.45, lng: 30.52 };
const ctl = () => new AbortController();

type Handler = (url: string, init?: RequestInit) => unknown;
let routes: [string, Handler][] = [];
const calls: { url: string; init?: RequestInit }[] = [];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const on = (part: string, h: Handler) => routes.push([part, h]);

/** Gym search is gated on the geo-search consent (SPO-293): these cases run with it granted. */
const grantGeo = () => setGeoSearchState({ on: true, ready: true, answered: true });

beforeEach(() => {
  resetGeoGateForTests();
  grantGeo();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
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
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const gym = (id: string, name: string, lat: number, lng: number) =>
  ({ id, name, lat, lng }) as unknown as Gym;
const place = (
  name: string,
  lat: number,
  lng: number,
  extra: Partial<PlaceResult> = {},
): PlaceResult => ({
  key: name,
  name,
  lat,
  lng,
  sources: ['osm'],
  ...extra,
});

describe('geometry helpers', () => {
  it('haversine: 0 for the same point, ~111 km per degree of latitude, symmetric', () => {
    expect(haversineM(KYIV, KYIV)).toBe(0);
    const d = haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
    expect(haversineM(KYIV, { lat: 51, lng: 31 })).toBeCloseTo(
      haversineM({ lat: 51, lng: 31 }, KYIV),
      6,
    );
  });
  it('bboxAround widens longitude with latitude and is centred', () => {
    const [s, w, n, e] = bboxAround({ lat: 0, lng: 10 }, 1000);
    expect(n - 0).toBeCloseTo(1000 / 111_320, 9);
    expect(0 - s).toBeCloseTo(1000 / 111_320, 9);
    expect(e - 10).toBeCloseTo(10 - w, 12);
    const [, w60, , e60] = bboxAround({ lat: 60, lng: 10 }, 1000);
    expect(e60 - w60).toBeCloseTo(2 * (1000 / (111_320 * 0.5)), 6);
  });
  it('bboxAround never divides by ~0 at the poles', () => {
    const [, w, , e] = bboxAround({ lat: 90, lng: 0 }, 1000);
    expect(Number.isFinite(e - w)).toBe(true);
    expect(e - w).toBeCloseTo(2 * (1000 / (111_320 * 0.1)), 6);
  });
  it('fmtDistance rounds to 10 m below 950 m and to 0.1 km from there', () => {
    expect(fmtDistance(0)).toBe('0 m');
    expect(fmtDistance(244)).toBe('240 m');
    expect(fmtDistance(245)).toBe('250 m');
    expect(fmtDistance(949)).toBe('950 m');
    expect(fmtDistance(960)).toBe('1.0 km');
    expect(fmtDistance(1234)).toBe('1.2 km');
  });
  it('staticMapThumb returns the OSM tile that holds the point', () => {
    expect(staticMapThumb(0, 0, 1)).toBe('https://tile.openstreetmap.org/1/1/1.png');
    expect(staticMapThumb(50.45, 30.52)).toBe('https://tile.openstreetmap.org/16/38323/22098.png');
    expect(staticMapThumb(-33.87, 151.21, 10)).toMatch(/\/10\/\d+\/\d+\.png$/);
  });
});

describe('mergeResults', () => {
  it('unions sources and fills only the missing fields, never reordering', () => {
    const acc = [place('Alpha Gym', 50.45, 30.52, { address: 'Main 1' })];
    const out = mergeResults(acc, [
      place('Alpha', 50.4501, 30.5201, {
        sources: ['overpass'],
        photoUrl: 'p.jpg',
        address: 'Other 2',
        externalId: 'g:1',
        wikimediaCommons: 'File:A.jpg',
        brandWikidata: 'Q1',
        amenities: ['sauna'],
      }),
      place('Beta', 51, 31),
    ]);
    expect(out).toBe(acc);
    expect(out.map((p) => p.name)).toEqual(['Alpha Gym', 'Beta']);
    expect(out[0]).toMatchObject({
      sources: ['osm', 'overpass'],
      photoUrl: 'p.jpg',
      address: 'Main 1',
      externalId: 'g:1',
      wikimediaCommons: 'File:A.jpg',
      brandWikidata: 'Q1',
    });
    expect(out[0].amenities).toEqual(['sauna']);
  });
  it('does not mutate the incoming row it appends (sources are copied)', () => {
    const inc = place('Gamma', 52, 32, { sources: ['osm'] });
    const out = mergeResults([], [inc]);
    out[0].sources.push('overpass');
    expect(inc.sources).toEqual(['osm']);
  });
  it('merges rows that share an external id even when far apart', () => {
    const out = mergeResults(
      [place('A', 50, 30, { externalId: 'osm:n1' })],
      [place('Totally different', 10, 10, { externalId: 'osm:n1', sources: ['overpass'] })],
    );
    expect(out).toHaveLength(1);
    expect(out[0].sources).toEqual(['osm', 'overpass']);
  });
  it('keeps same-name places more than 60 m apart as two venues', () => {
    const out = mergeResults([place('Zdrofit', 50.45, 30.52)], [place('Zdrofit', 50.451, 30.52)]);
    expect(out).toHaveLength(2);
  });
});

describe('parseOpeningHours', () => {
  it('is null for empty, unparseable and closed-only strings', () => {
    expect(parseOpeningHours(undefined)).toBeNull();
    expect(parseOpeningHours('')).toBeNull();
    expect(parseOpeningHours('by appointment')).toBeNull();
    expect(parseOpeningHours('Mo off')).toBeNull();
  });
  it('24/7 and 00:00-24:00 open every day all day', () => {
    const all = Array.from({ length: 7 }, () => [[0, 1440]]);
    expect(parseOpeningHours('24/7')!.week).toEqual(all);
    expect(parseOpeningHours(' 24 / 7 ')!.week).toEqual(all);
    expect(parseOpeningHours('Mo-Su 00:00-24:00')!.week).toEqual(all);
  });
  it('reads day ranges, lists, several ranges and later rules overriding earlier', () => {
    const w = parseOpeningHours('Mo-Fr 06:00-22:00; Sa,Su 08:00-20:00; We off')!.week;
    expect(w[0]).toEqual([[360, 1320]]);
    expect(w[4]).toEqual([[360, 1320]]);
    expect(w[5]).toEqual([[480, 1200]]);
    expect(w[6]).toEqual([[480, 1200]]);
    expect(w[2]).toEqual([[360, 1320]]); // "off" leaves earlier hours untouched
    const split = parseOpeningHours('Mo 07:00-12:00,14:00-21:30')!.week;
    expect(split[0]).toEqual([
      [420, 720],
      [840, 1290],
    ]);
    expect(parseOpeningHours('Mo-Fr 06:00-22:00; Tu 10:00-12:00')!.week[1]).toEqual([[600, 720]]);
  });
  it('wraps a day range across the week end and applies bare hours to every day', () => {
    const wrap = parseOpeningHours('Sa-Mo 09:00-18:00')!.week;
    expect([wrap[5].length, wrap[6].length, wrap[0].length, wrap[1].length]).toEqual([1, 1, 1, 0]);
    const bare = parseOpeningHours('07:00-23:00')!.week;
    expect(bare.every((d) => d[0][0] === 420 && d[0][1] === 1380)).toBe(true);
  });
  it('ignores unknown day names and blank rules', () => {
    const w = parseOpeningHours(';; Xx 09:00-10:00 ; Mo 08:00-09:00;')!.week;
    // "Xx" is no day, so that rule applies to all days; Mo is then overridden
    expect(w[0]).toEqual([[480, 540]]);
    expect(w[3]).toEqual([[540, 600]]);
  });
  it('a bad range endpoint in a day list is skipped', () => {
    expect(parseOpeningHours('Mo-Xx 09:00-10:00')!.week[0]).toEqual([[540, 600]]);
  });
});

describe('searchNearbyGyms (Overpass)', () => {
  const el = (id: number, name: string | undefined, lat: number, lon: number, tags = {}) => ({
    type: 'node',
    id,
    lat,
    lon,
    tags: { name, ...tags },
  });

  it('without the geo-search consent it returns the saved gyms only and asks Overpass nothing', async () => {
    resetGeoGateForTests();
    on('overpass', () => json({ elements: [el(1, 'Far Gym', 50.46, 30.52)] }));
    const out = await searchNearbyGyms(
      KYIV,
      2000,
      [gym('g1', 'Saved', 50.45, 30.52)],
      ctl().signal,
    );
    expect(out.map((p) => p.name)).toEqual(['Saved']);
    expect(calls).toHaveLength(0);
  });

  it('queries a bbox around the user, keeps named elements inside the radius, nearest first', async () => {
    on('overpass', () =>
      json({
        elements: [
          el(1, 'Far Gym', 50.46, 30.52, {
            'addr:street': 'Main',
            'addr:housenumber': '5',
            'addr:city': 'Kyiv',
          }),
          el(2, 'Near Gym', 50.4503, 30.52, {
            'brand:wikidata': 'Q9',
            wikimedia_commons: 'File:N.jpg',
          }),
          el(3, undefined, 50.4501, 30.52),
          { type: 'way', id: 4, center: { lat: 50.4502, lon: 30.52 }, tags: { name: ' Way Gym ' } },
          { type: 'way', id: 5, tags: { name: 'No Coords' } },
          el(6, 'Outside', 51.5, 30.52),
        ],
      }),
    );
    const out = await searchNearbyGyms(KYIV, 2000, [], ctl().signal);
    expect(out.map((p) => p.name)).toEqual(['Way Gym', 'Near Gym', 'Far Gym']);
    expect(out[1]).toMatchObject({
      key: 'overpass:node2',
      externalId: 'osm:node2',
      brandWikidata: 'Q9',
      wikimediaCommons: 'File:N.jpg',
      sources: ['overpass'],
    });
    expect(out[2].address).toBe('Main 5, Kyiv');
    expect(out[1].address).toBeUndefined();
    const sent = String((calls[0].init!.body as URLSearchParams).get('data'));
    expect(sent).toContain('[out:json]');
    expect(sent).toContain(`${KYIV.lat - 2000 / 111_320}`);
  });
  it('puts saved gyms in range first-class and merges the same venue from Overpass', async () => {
    on('overpass', () => json({ elements: [el(2, 'Iron House', 50.4501, 30.5201)] }));
    const out = await searchNearbyGyms(
      KYIV,
      2000,
      [gym('g1', 'Iron House Gym', 50.45, 30.52), gym('g2', 'Faraway', 40, 20)],
      ctl().signal,
    );
    expect(out).toHaveLength(1);
    expect(out[0].sources).toEqual(['local', 'overpass']);
    expect(out[0].key).toBe('local:g1');
  });
  it('handles an empty answer and throws on a bad status', async () => {
    on('overpass', () => json({}));
    expect(await searchNearbyGyms(KYIV, 500, [], ctl().signal)).toEqual([]);
    routes = [];
    on('overpass', () => json({}, 504));
    await expect(searchNearbyGyms(KYIV, 500, [], ctl().signal)).rejects.toThrow('overpass 504');
  });
});

describe('searchGyms', () => {
  const photon = (features: unknown[]) => json({ features });
  const feat = (name: string | undefined, lon: number, lat: number, pr: object = {}) => ({
    geometry: { coordinates: [lon, lat] },
    properties: { name, osm_id: 7, osm_type: 'N', ...pr },
  });
  const run = (q: string, coords: typeof KYIV | null = KYIV, saved: Gym[] = []) => {
    const states: [ProviderId, ProviderState][] = [];
    const snaps: PlaceResult[][] = [];
    const ac = ctl();
    const p = searchGyms(q, coords, saved, ac.signal, {
      onProvider: (id, s) => states.push([id, s]),
      onResults: (m) => snaps.push(m),
    });
    return { p, states, snaps, ac };
  };

  it('runs every provider, streams merged snapshots and states, and caches the result', async () => {
    on('photon', () =>
      photon([
        feat('Smartass Gym', 30.52, 50.45, {
          street: 'Khreshchatyk',
          housenumber: '1',
          city: 'Kyiv',
          country: 'UA',
        }),
        feat(undefined, 1, 1),
        { properties: { name: 'No geometry' } },
      ]),
    );
    const { p, states, snaps } = run('smartass', KYIV, [gym('g1', 'Smartass', 50.45, 30.52)]);
    const merged = await p;
    expect(merged).toHaveLength(1);
    expect(merged[0].sources.sort()).toEqual(['local', 'osm']);
    expect(merged[0].address).toBe('Khreshchatyk 1, Kyiv, UA');
    expect(states.slice(0, 2)).toEqual([
      ['local', { status: 'pending' }],
      ['osm', { status: 'pending' }],
    ]);
    const final = (id: ProviderId) => states.filter(([i]) => i === id).at(-1)![1];
    expect(final('local')).toEqual({ status: 'answered', count: 1 });
    expect(final('osm')).toEqual({ status: 'answered', count: 1 });
    expect(snaps.length).toBe(2);
    expect(readCache('smartass', KYIV)).toEqual(merged);
  });
  it('queries Photon with the user position and sends the browser language', async () => {
    on('photon', () => photon([]));
    await run('zdrofit').p;
    expect(calls[0].url).toContain('q=zdrofit');
    expect(calls[0].url).toContain('limit=40');
    expect(calls[0].url).toContain('lat=50.45');
    expect(calls[0].url).toContain('lon=30.52');
    expect((calls[0].init!.headers as Record<string, string>)['Accept-Language']).toBeTruthy();
    calls.length = 0;
    await run('zdrofit', null).p;
    expect(calls[0].url).not.toContain('lat=');
  });
  it('a Cyrillic query is also searched in Latin transliteration and the answers merge', async () => {
    on('photon', (url) =>
      url.includes('q=zdrofit')
        ? photon([feat('Zdrofit', 30.52, 50.45)])
        : photon([feat('Здрофіт', 30.5201, 50.4501, { osm_id: 8 })]),
    );
    const { p } = run('Здрофіт');
    const merged = await p;
    const qs = calls.map((c) => new URL(c.url).searchParams.get('q'));
    expect(qs).toContain('Здрофіт');
    expect(qs).toContain('zdrofit');
    expect(merged.filter((m) => m.sources.includes('osm'))).toHaveLength(2);
  });
  it('transliterates multi-letter mappings and drops soft signs', async () => {
    on('photon', () => photon([]));
    await run('щастя').p;
    await run('юлія ь').p;
    const qs = calls.map((c) => new URL(c.url).searchParams.get('q'));
    expect(qs).toContain('shchastia');
    expect(qs).toContain('iuliia ');
  });
  it('a failing provider is logged, reported, and does not block the others', async () => {
    on('photon', () => json({}, 500));
    const { p, states } = run('x', KYIV, [gym('g1', 'Xtreme', 50.45, 30.52)]);
    const merged = await p;
    expect(merged).toHaveLength(1);
    expect(states.filter(([i]) => i === 'osm').at(-1)![1]).toEqual({
      status: 'failed',
      reason: 'osm 500',
    });
    expect(console.warn).toHaveBeenCalledWith('[gym-search] osm failed:', 'osm 500');
  });
  it('a non-Error rejection is reported as "failed"', async () => {
    on('photon', () => Promise.reject('boom'));
    const { p, states } = run('x');
    await p;
    expect(states.filter(([i]) => i === 'osm').at(-1)![1]).toEqual({
      status: 'failed',
      reason: 'failed',
    });
  });
  it('queries only local + OpenStreetMap services: no Google Places / Foursquare provider exists', async () => {
    on('photon', () => photon([]));
    const { p, states } = run('gym', KYIV);
    await p;
    expect([...new Set(states.map(([i]) => i))].sort()).toEqual(['local', 'osm']);
    expect(calls.some((c) => /googleapis|foursquare/.test(c.url))).toBe(false);
  });
  it('without the geo-search consent no request leaves the device: Photon fails with the reason, saved gyms still answer', async () => {
    resetGeoGateForTests();
    on('photon', () => photon([feat('Smartass Gym', 30.52, 50.45)]));
    const { p, states } = run('smartass', KYIV, [gym('g1', 'Smartass', 50.45, 30.52)]);
    const merged = await p;
    expect(calls).toHaveLength(0);
    expect(merged.map((m) => m.sources)).toEqual([['local']]);
    expect(states.filter(([i]) => i === 'osm').at(-1)![1]).toMatchObject({
      status: 'skipped',
      reason: 'Gym search and maps are off: no consent',
    });
    expect(states.filter(([i]) => i === 'local').at(-1)![1]).toEqual({
      status: 'answered',
      count: 1,
    });
  });
  it('an empty query finds nothing locally; nothing is cached for no results', async () => {
    on('photon', () => photon([]));
    const merged = await run('  ', KYIV, [gym('g1', 'Anything', 50.45, 30.52)]).p;
    expect(merged).toEqual([]);
    expect(readCache('  ', KYIV)).toBeNull();
  });
  it('an aborted search reports nothing after the abort and caches nothing', async () => {
    let release!: () => void;
    on(
      'photon',
      () => new Promise((r) => (release = () => r(photon([feat('Late', 30.52, 50.45)])))),
    );
    const { p, states, snaps, ac } = run('late', KYIV, []);
    ac.abort();
    release();
    await p;
    expect(snaps).toEqual([]);
    expect(states.every(([, s]) => s.status === 'pending')).toBe(true);
    expect(readCache('late', KYIV)).toBeNull();
  });
  it('an abort-time rejection is silent', async () => {
    on('photon', () => Promise.reject(new Error('aborted')));
    const { p, states, ac } = run('late');
    ac.abort();
    await p;
    expect(states.some(([, s]) => s.status === 'failed')).toBe(false);
  });
});

describe('search cache', () => {
  const rows = [place('Cached Gym', 50.45, 30.52)];
  const write = (at: number) =>
    localStorage.setItem('gym.search.cached|50.45,30.52', JSON.stringify({ at, results: rows }));
  it('is keyed by normalised query and a 100 m cell; null without a position is a separate key', () => {
    write(NOW);
    expect(readCache('Cached!', { lat: 50.4504, lng: 30.5196 })).toEqual(rows);
    expect(readCache('cached', { lat: 50.46, lng: 30.52 })).toBeNull();
    expect(readCache('cached', null)).toBeNull();
  });
  it('expires after 24 h (exactly 24 h is still fresh)', () => {
    write(NOW - DAY);
    expect(readCache('cached', KYIV)).toEqual(rows);
    write(NOW - DAY - 1);
    expect(readCache('cached', KYIV)).toBeNull();
  });
  it('is null for corrupt or unreadable storage', () => {
    localStorage.setItem('gym.search.cached|50.45,30.52', '{bad');
    expect(readCache('cached', KYIV)).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readCache('cached', KYIV)).toBeNull();
  });
  it('a full storage does not break the search', async () => {
    on('photon', () => json({ features: [] }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const merged = await searchGyms('q', KYIV, [gym('g1', 'Qgym', 50.45, 30.52)], ctl().signal, {
      onProvider: () => {},
      onResults: () => {},
    });
    expect(merged).toHaveLength(1);
  });
});

describe('reverse geocode', () => {
  it('formats street, city (or district), state, country, and caches it', async () => {
    on('photon.komoot.io/reverse', () =>
      json({
        features: [
          {
            properties: {
              street: 'Main',
              housenumber: '5',
              district: 'Podil',
              state: 'Kyiv Oblast',
              country: 'Ukraine',
            },
          },
        ],
      }),
    );
    const a = await resolveAddress(50.45, 30.52, ctl().signal);
    expect(a).toBe('Main 5, Podil, Kyiv Oblast, Ukraine');
    expect(await resolveAddress(50.450001, 30.520001, ctl().signal)).toBe(a);
    expect(calls).toHaveLength(1);
  });
  it('prefers city over district; no fields means null (cached as null)', async () => {
    on('reverse', () => json({ features: [{ properties: { city: 'Lviv', district: 'X' } }] }));
    expect(await resolveAddress(49.84, 24.03, ctl().signal)).toBe('Lviv');
    routes = [];
    on('reverse', () => json({ features: [] }));
    expect(await resolveAddress(1, 1, ctl().signal)).toBeNull();
    expect(await resolveAddress(1, 1, ctl().signal)).toBeNull();
    expect(calls.filter((c) => c.url.includes('lat=1&'))).toHaveLength(1);
  });
  it('shares one in-flight request between concurrent callers', async () => {
    on('reverse', () => json({ features: [{ properties: { city: 'Odesa' } }] }));
    const [a, b] = await Promise.all([
      resolveAddress(46.48, 30.72, ctl().signal),
      resolveAddress(46.48, 30.72, ctl().signal),
    ]);
    expect([a, b]).toEqual(['Odesa', 'Odesa']);
    expect(calls).toHaveLength(1);
  });
  it('HTTP failure is null and not cached; a network error is null; an aborted one throws', async () => {
    on('reverse', () => json({}, 500));
    expect(await resolveAddress(2, 2, ctl().signal)).toBeNull();
    routes = [];
    on('reverse', () => Promise.reject(new Error('net')));
    expect(await resolveAddress(2, 2, ctl().signal)).toBeNull();
    const ac = ctl();
    ac.abort();
    await expect(resolveAddress(2, 2, ac.signal)).rejects.toThrow('net');
  });
  it('cacheAddress seeds a known address, ignores an empty one, and expires after 90 days', async () => {
    cacheAddress(3, 3, 'Seeded 1');
    expect(await resolveAddress(3, 3, ctl().signal)).toBe('Seeded 1');
    cacheAddress(4, 4, undefined);
    on('reverse', () => json({ features: [{ properties: { city: 'Fresh' } }] }));
    expect(await resolveAddress(4, 4, ctl().signal)).toBe('Fresh');
    vi.setSystemTime(NOW + 90 * DAY + 1);
    expect(await resolveAddress(3, 3, ctl().signal)).toBe('Fresh');
  });
  it('treats a corrupt cache entry as a miss', async () => {
    localStorage.setItem('gym.addr.5,5', '{bad');
    on('reverse', () => json({ features: [{ properties: { city: 'Ok' } }] }));
    expect(await resolveAddress(5, 5, ctl().signal)).toBe('Ok');
  });
});
