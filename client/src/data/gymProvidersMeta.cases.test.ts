import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaceResult } from './gymProviders';

const NOW = new Date('2026-05-04T10:00:00Z').getTime();
const DAY = 86_400_000;

type Handler = (url: string, init?: RequestInit) => unknown;
let routes: [string, Handler][] = [];
const calls: { url: string; init?: RequestInit }[] = [];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const on = (part: string, h: Handler) => routes.push([part, h]);
const ctl = () => new AbortController();

/** The Google key is read at import time, so each scenario loads the module afresh. */
async function load(key = '') {
  vi.stubEnv('VITE_GOOGLE_PLACES_KEY', key);
  vi.resetModules();
  return import('./gymProviders');
}

const row = (extra: Partial<PlaceResult> = {}): PlaceResult => ({
  key: 'k',
  name: 'Zdrofit',
  lat: 50.45,
  lng: 30.52,
  sources: ['osm'],
  ...extra,
});

beforeEach(() => {
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
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('brandLogo', () => {
  const wikidata = (qid: string | null, file: string | null, thumb: string | null) => {
    on('wbsearchentities', () => json({ search: qid ? [{ id: qid }] : [] }));
    on('wbgetclaims', () =>
      json({ claims: file ? { P154: [{ mainsnak: { datavalue: { value: file } } }] } : {} }),
    );
    on('commons.wikimedia.org', () =>
      json({ query: { pages: { 1: { imageinfo: thumb ? [{ thumburl: thumb }] : [] } } } }),
    );
  };
  it('is null for a blank name without any request', async () => {
    const m = await load();
    expect(await m.brandLogo('   ', ctl().signal)).toBeNull();
    expect(calls).toHaveLength(0);
  });
  it('takes the Wikidata wordmark first, via its Commons thumbnail, and caches per brand', async () => {
    wikidata('Q42', 'McFit.svg', 'https://thumb/mcfit.png');
    const m = await load();
    expect(await m.brandLogo('McFit', ctl().signal)).toBe('https://thumb/mcfit.png');
    const n = calls.length;
    expect(await m.brandLogo('  MCFIT ', ctl().signal)).toBe('https://thumb/mcfit.png');
    expect(calls).toHaveLength(n);
    const claims = calls.find((c) => c.url.includes('wbgetclaims'))!.url;
    expect(claims).toContain('entity=Q42');
    expect(claims).toContain('property=P154');
    expect(calls.find((c) => c.url.includes('commons'))!.url).toContain('titles=File%3AMcFit.svg');
  });
  it('falls back to Clearbit → DuckDuckGo icon when Wikidata has no logo', async () => {
    wikidata('Q1', null, null);
    on('clearbit', () => json([{ domain: 'zdrofit.pl' }]));
    const m = await load();
    expect(await m.brandLogo('Zdrofit', ctl().signal)).toBe(
      'https://icons.duckduckgo.com/ip3/zdrofit.pl.ico',
    );
  });
  it('is null (and remembered as null) when nobody knows the brand', async () => {
    wikidata(null, null, null);
    on('clearbit', () => json([]));
    const m = await load();
    expect(await m.brandLogo('Nowhere', ctl().signal)).toBeNull();
    const n = calls.length;
    expect(await m.brandLogo('Nowhere', ctl().signal)).toBeNull();
    expect(calls).toHaveLength(n);
  });
  it('survives HTTP errors on each step', async () => {
    on('wbsearchentities', () => json({}, 500));
    on('clearbit', () => json({}, 500));
    const m = await load();
    expect(await m.brandLogo('Broken', ctl().signal)).toBeNull();
  });
  it('survives network errors and caches the miss', async () => {
    on('wbsearchentities', () => Promise.reject(new Error('net')));
    on('clearbit', () => Promise.reject(new Error('net')));
    const m = await load();
    expect(await m.brandLogo('Offline', ctl().signal)).toBeNull();
  });
  it('shares one lookup between concurrent callers', async () => {
    wikidata('Q1', 'A.svg', 'https://t/a.png');
    const m = await load();
    const [a, b] = await Promise.all([
      m.brandLogo('Alpha', ctl().signal),
      m.brandLogo('alpha', ctl().signal),
    ]);
    expect([a, b]).toEqual(['https://t/a.png', 'https://t/a.png']);
    expect(calls.filter((c) => c.url.includes('wbsearchentities'))).toHaveLength(1);
  });
  it('does not cache an aborted lookup: it rejects, and a later retry works', async () => {
    on('wbsearchentities', () => Promise.reject(new Error('aborted')));
    on('clearbit', () => Promise.reject(new Error('aborted')));
    const m = await load();
    const ac = ctl();
    ac.abort();
    await expect(m.brandLogo('Retry', ac.signal)).rejects.toThrow('aborted');
    routes = [];
    wikidata('Q1', 'R.svg', 'https://t/r.png');
    expect(await m.brandLogo('Retry', ctl().signal)).toBe('https://t/r.png');
  });
  it('ignores a stale (30+ days) cache entry and a corrupt one', async () => {
    localStorage.setItem('gym.logo.old', JSON.stringify({ at: NOW - 30 * DAY - 1, url: 'stale' }));
    localStorage.setItem('gym.logo.bad', '{x');
    localStorage.setItem('gym.logo.fresh', JSON.stringify({ at: NOW - 30 * DAY, url: 'fresh' }));
    wikidata('Q1', 'O.svg', 'https://t/o.png');
    const m = await load();
    expect(await m.brandLogo('old', ctl().signal)).toBe('https://t/o.png');
    expect(await m.brandLogo('bad', ctl().signal)).toBe('https://t/o.png');
    expect(await m.brandLogo('fresh', ctl().signal)).toBe('fresh');
  });
});

describe('resolvePhoto (no Google key)', () => {
  it('uses the venue photo as is, with no request', async () => {
    const m = await load();
    expect(await m.resolvePhoto(row({ photoUrl: 'https://x/p.jpg' }), ctl().signal)).toBe(
      'https://x/p.jpg',
    );
    expect(calls).toHaveLength(0);
  });
  it('then the Commons file, adding File: when missing', async () => {
    on('commons.wikimedia.org', () =>
      json({ query: { pages: { 9: { imageinfo: [{ url: 'https://full/x.jpg' }] } } } }),
    );
    const m = await load();
    expect(await m.resolvePhoto(row({ wikimediaCommons: 'Gym.jpg' }), ctl().signal)).toBe(
      'https://full/x.jpg',
    );
    expect(calls[0].url).toContain('titles=File%3AGym.jpg');
    expect(calls[0].url).toContain('iiurlwidth=320');
  });
  it('prefers the thumbnail over the full url; skips pages without image info', async () => {
    on('commons.wikimedia.org', () =>
      json({
        query: {
          pages: {
            1: {},
            2: { imageinfo: [{ thumburl: 'https://t/2.jpg', url: 'https://f/2.jpg' }] },
          },
        },
      }),
    );
    const m = await load();
    expect(await m.resolvePhoto(row({ wikimediaCommons: 'File:G.jpg' }), ctl().signal)).toBe(
      'https://t/2.jpg',
    );
  });
  it('then the brand Wikidata logo, then the name-based brand logo', async () => {
    on('wbgetclaims', () =>
      json({ claims: { P154: [{ mainsnak: { datavalue: { value: 'L.svg' } } }] } }),
    );
    on('commons.wikimedia.org', () =>
      json({ query: { pages: { 1: { imageinfo: [{ thumburl: 'https://t/l.png' }] } } } }),
    );
    const m = await load();
    expect(await m.resolvePhoto(row({ brandWikidata: 'Q5' }), ctl().signal)).toBe(
      'https://t/l.png',
    );
    routes = [];
    on('wbsearchentities', () => json({ search: [] }));
    on('clearbit', () => json([{ domain: 'x.com' }]));
    expect(await m.resolvePhoto(row({ name: 'Xfit' }), ctl().signal)).toBe(
      'https://icons.duckduckgo.com/ip3/x.com.ico',
    );
  });
  it('falls through a Commons miss to the next source, and to null at the end', async () => {
    on('commons.wikimedia.org', () => json({}, 404));
    on('wbsearchentities', () => json({ search: [] }));
    on('clearbit', () => json([]));
    const m = await load();
    expect(await m.resolvePhoto(row({ wikimediaCommons: 'File:G.jpg' }), ctl().signal)).toBeNull();
  });
  it('rethrows when aborted, swallows other errors', async () => {
    on('commons.wikimedia.org', () => Promise.reject(new Error('aborted')));
    const m = await load();
    const ac = ctl();
    ac.abort();
    await expect(
      m.resolvePhoto(row({ wikimediaCommons: 'File:G.jpg' }), ac.signal),
    ).rejects.toThrow('aborted');
    expect(
      await m.resolvePhoto(row({ wikimediaCommons: 'File:G.jpg', name: '' }), ctl().signal),
    ).toBeNull();
  });
});

describe('resolveGymMeta (OSM via Nominatim, no Google key)', () => {
  const nominatim = (extratags: Record<string, string> | undefined, type = 'gym') =>
    on('nominatim', () => json({ type, category: 'leisure', extratags }));
  it('reads hours, website (with fallbacks), phone and category', async () => {
    nominatim({ opening_hours: 'Mo-Su 06:00-22:00', url: 'https://u', phone: '+48 1' });
    const m = await load();
    expect(await m.resolveGymMeta(50.45, 30.52, ctl().signal, 'Zdrofit')).toEqual({
      openingHours: 'Mo-Su 06:00-22:00',
      website: 'https://u',
      phone: '+48 1',
      category: 'gym',
    });
    expect(calls[0].url).toContain('lat=50.45&lon=30.52');
  });
  it('website falls back website → url → contact:website; phone → contact:phone; category → category', async () => {
    nominatim({ 'contact:website': 'https://c', 'contact:phone': '+1' }, '');
    const m = await load();
    expect(await m.resolveGymMeta(1, 1, ctl().signal)).toMatchObject({
      website: 'https://c',
      phone: '+1',
      category: 'leisure',
    });
  });
  it('copes with no extratags', async () => {
    nominatim(undefined);
    const m = await load();
    expect(await m.resolveGymMeta(2, 2, ctl().signal)).toEqual({
      openingHours: undefined,
      website: undefined,
      phone: undefined,
      category: 'gym',
    });
  });
  it('caches for 14 days per ~1 m cell', async () => {
    nominatim({ phone: '1' });
    const m = await load();
    await m.resolveGymMeta(3, 3, ctl().signal);
    await m.resolveGymMeta(3.000001, 3, ctl().signal);
    expect(calls).toHaveLength(1);
    vi.setSystemTime(NOW + 14 * DAY);
    await m.resolveGymMeta(3, 3, ctl().signal);
    expect(calls).toHaveLength(1);
    vi.setSystemTime(NOW + 14 * DAY + 1);
    await m.resolveGymMeta(3, 3, ctl().signal);
    expect(calls).toHaveLength(2);
  });
  it('shares one in-flight request', async () => {
    nominatim({ phone: '1' });
    const m = await load();
    await Promise.all([m.resolveGymMeta(4, 4, ctl().signal), m.resolveGymMeta(4, 4, ctl().signal)]);
    expect(calls).toHaveLength(1);
  });
  it('an HTTP error is null; a network error is null; an aborted one throws', async () => {
    on('nominatim', () => json({}, 500));
    const m = await load();
    expect(await m.resolveGymMeta(5, 5, ctl().signal)).toBeNull();
    routes = [];
    on('nominatim', () => Promise.reject(new Error('aborted')));
    expect(await m.resolveGymMeta(6, 6, ctl().signal)).toBeNull();
    const ac = ctl();
    ac.abort();
    await expect(m.resolveGymMeta(7, 7, ac.signal)).rejects.toThrow('aborted');
  });
  it('a corrupt cache entry is a miss; a full storage does not lose the answer', async () => {
    localStorage.setItem('gym.meta.8,8', '{bad');
    nominatim({ phone: '8' });
    const m = await load();
    expect(await m.resolveGymMeta(8, 8, ctl().signal)).toMatchObject({ phone: '8' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(await m.resolveGymMeta(9, 9, ctl().signal)).toMatchObject({ phone: '8' });
  });
});

describe('with a Google Places key', () => {
  const periods = [
    { open: { day: 1, hour: 6, minute: 30 }, close: { day: 1, hour: 22, minute: 0 } },
    { open: { day: 0, hour: 8 }, close: { day: 0, hour: 20 } },
    { open: { day: 5, hour: 18 }, close: { day: 6, hour: 2 } },
    { open: { day: 3, hour: 0 } },
    { close: { day: 2, hour: 1 } },
  ];
  const place = {
    photos: [{ name: 'places/p1/photos/x' }],
    websiteUri: 'https://gym.example',
    internationalPhoneNumber: '+380 44',
    regularOpeningHours: { periods, weekdayDescriptions: ['Mon: 6–22', 'Tue: closed'] },
    currentOpeningHours: { openNow: true },
  };
  const google = (p: unknown = place) =>
    on('places.googleapis.com', () => json({ places: p ? [p] : [] }));

  it('googleLookup is null without a name', async () => {
    const m = await load('KEY');
    expect(await m.googleLookup('', 1, 1, ctl().signal)).toBeNull();
    expect(calls).toHaveLength(0);
  });
  it('googleLookup is null without a key, with no request', async () => {
    const m = await load('');
    expect(await m.googleLookup('Gym', 1, 1, ctl().signal)).toBeNull();
    expect(calls).toHaveLength(0);
  });
  it('maps photo, website, phone, open-now and Monday-first structured hours', async () => {
    google();
    const m = await load('KEY');
    const info = await m.googleLookup('Zdrofit', 50.45, 30.52, ctl().signal);
    expect(info).toMatchObject({
      photoUrl: 'https://places.googleapis.com/v1/places/p1/photos/x/media?maxWidthPx=1200&key=KEY',
      website: 'https://gym.example',
      phone: '+380 44',
      openNow: true,
      hoursRaw: ['Mon: 6–22', 'Tue: closed'],
    });
    const w = info!.hours!.week;
    expect(w[0]).toEqual([[390, 1320]]); // Google Monday (1) -> index 0
    expect(w[6]).toEqual([[480, 1200]]); // Google Sunday (0) -> index 6
    expect(w[4]).toEqual([[1080, 1440]]); // closes the next day -> capped at midnight
    expect(w[2]).toEqual([[0, 1440]]); // open with no close -> all day
    expect(w[1]).toEqual([]); // a period with no "open" is ignored
    const sent = calls[0];
    expect((sent.init!.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('KEY');
    expect(JSON.parse(String(sent.init!.body))).toMatchObject({
      textQuery: 'Zdrofit',
      maxResultCount: 1,
    });
  });
  it('has no hours when there are no periods or none usable', async () => {
    google({ regularOpeningHours: { periods: [] } });
    const m = await load('KEY');
    expect((await m.googleLookup('A', 1, 1, ctl().signal))!.hours).toBeUndefined();
    routes = [];
    google({ regularOpeningHours: { periods: [{ close: { day: 1, hour: 1 } }] } });
    expect((await m.googleLookup('B', 2, 2, ctl().signal))!.hours).toBeUndefined();
  });
  it('is null when Google has no match or answers with an error', async () => {
    google(null);
    const m = await load('KEY');
    expect(await m.googleLookup('A', 1, 1, ctl().signal)).toBeNull();
    routes = [];
    on('places.googleapis.com', () => json({}, 403));
    expect(await m.googleLookup('B', 2, 2, ctl().signal)).toBeNull();
  });
  it('caches for 7 days and shares one in-flight request', async () => {
    google();
    const m = await load('KEY');
    await Promise.all([
      m.googleLookup('A', 1, 1, ctl().signal),
      m.googleLookup('A', 1, 1, ctl().signal),
    ]);
    expect(calls).toHaveLength(1);
    vi.setSystemTime(NOW + 7 * DAY);
    await m.googleLookup('A', 1, 1, ctl().signal);
    expect(calls).toHaveLength(1);
    vi.setSystemTime(NOW + 7 * DAY + 1);
    await m.googleLookup('A', 1, 1, ctl().signal);
    expect(calls).toHaveLength(2);
  });
  it('a network error is null, an aborted one throws, bad cache is a miss', async () => {
    on('places.googleapis.com', () => Promise.reject(new Error('aborted')));
    const m = await load('KEY');
    expect(await m.googleLookup('A', 1, 1, ctl().signal)).toBeNull();
    const ac = ctl();
    ac.abort();
    await expect(m.googleLookup('B', 2, 2, ac.signal)).rejects.toThrow('aborted');
    localStorage.setItem('gym.google.3,3', '{bad');
    expect(await m.googleLookup('C', 3, 3, ctl().signal)).toBeNull();
  });
  it('resolvePhoto prefers the Google photo, then falls back to the keyless chain', async () => {
    google();
    const m = await load('KEY');
    expect(await m.resolvePhoto(row(), ctl().signal)).toContain('maxWidthPx=1200');
    routes = [];
    on('places.googleapis.com', () => json({ places: [{}] }));
    on('commons.wikimedia.org', () =>
      json({ query: { pages: { 1: { imageinfo: [{ thumburl: 'https://t/c.jpg' }] } } } }),
    );
    expect(
      await m.resolvePhoto(row({ lat: 9, lng: 9, wikimediaCommons: 'File:c.jpg' }), ctl().signal),
    ).toBe('https://t/c.jpg');
  });
  it('resolvePhoto rethrows an abort from Google', async () => {
    on('places.googleapis.com', () => Promise.reject(new Error('aborted')));
    const m = await load('KEY');
    const ac = ctl();
    ac.abort();
    await expect(m.resolvePhoto(row(), ac.signal)).rejects.toThrow('aborted');
  });
  it('resolveGymMeta uses Google hours, website and phone with raw hours joined', async () => {
    google();
    const m = await load('KEY');
    const meta = await m.resolveGymMeta(50.45, 30.52, ctl().signal, 'Zdrofit');
    expect(meta).toMatchObject({
      openingHours: 'Mon: 6–22 · Tue: closed',
      website: 'https://gym.example',
      phone: '+380 44',
      openNow: true,
      category: 'gym',
    });
    expect(meta!.hours!.week[0]).toEqual([[390, 1320]]);
    expect(calls.some((c) => c.url.includes('nominatim'))).toBe(false);
  });
  it('resolveGymMeta falls back to OSM when Google knows nothing useful, or fails', async () => {
    on('nominatim', () => json({ type: 'gym', extratags: { phone: 'osm' } }));
    on('places.googleapis.com', () => json({ places: [{}] }));
    const m = await load('KEY');
    expect(await m.resolveGymMeta(1, 1, ctl().signal, 'A')).toMatchObject({ phone: 'osm' });
    routes = routes.filter(([p]) => p === 'nominatim');
    on('places.googleapis.com', () => json({}, 500));
    expect(await m.resolveGymMeta(2, 2, ctl().signal, 'B')).toMatchObject({ phone: 'osm' });
  });
  it('resolveGymMeta rethrows an abort, and skips Google when no name is given', async () => {
    on('places.googleapis.com', () => Promise.reject(new Error('aborted')));
    on('nominatim', () => json({ type: 'gym', extratags: { phone: 'osm' } }));
    const m = await load('KEY');
    expect(await m.resolveGymMeta(3, 3, ctl().signal)).toMatchObject({ phone: 'osm' });
    expect(calls.some((c) => c.url.includes('places.googleapis.com'))).toBe(false);
    const ac = ctl();
    ac.abort();
    await expect(m.resolveGymMeta(4, 4, ac.signal, 'Named')).rejects.toThrow('aborted');
  });
});
