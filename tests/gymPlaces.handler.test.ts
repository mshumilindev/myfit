import { describe, expect, it, vi } from 'vitest';
import {
  GOOGLE_ENGINE,
  PHOTO_MAX_BYTES,
  googleConsentOn,
  gymPlacesHandler,
  mapPlaces,
  parseRequest,
  periodsToWeek,
  googleRequest,
} from '../functions/src/gymPlacesCore';
import { currentVersionOf } from '../functions/src/consentRecordsPure';

const V = currentVersionOf('geo-search');
const grant = (at: number, over: Record<string, unknown> = {}) => ({
  kind: 'geo-search',
  action: 'grant',
  version: V,
  at,
  engines: ['photon', GOOGLE_ENGINE],
  ...over,
});
const PHOTO = 'places/ChIJabc123/photos/AUc7_x-y';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function ports(over: Partial<Parameters<typeof gymPlacesHandler>[1]> = {}) {
  const fetchMock = vi.fn<typeof fetch>(async () => json({ places: [] }));
  return {
    fetchMock,
    p: {
      key: 'k-secret',
      records: async () => [grant(10)],
      fetch: fetchMock as unknown as typeof fetch,
      ...over,
    },
  };
}
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as { code?: string; message?: string }).code + ':' + (e as Error).message;
  }
  return 'ok';
};

describe('SPO-360 gymPlaces: input rules', () => {
  it('accepts search, nearby and photo; rejects everything else', () => {
    expect(parseRequest({ op: 'search', q: ' zdrofit ' })).toEqual({ op: 'search', q: 'zdrofit' });
    expect(parseRequest({ op: 'search', q: 'gym', lat: 52.1, lng: 21 })).toEqual({
      op: 'search',
      q: 'gym',
      lat: 52.1,
      lng: 21,
    });
    expect(parseRequest({ op: 'nearby', lat: 52.1, lng: 21, radiusM: 999999 })).toMatchObject({
      radiusM: 5000,
    });
    expect(parseRequest({ op: 'nearby', lat: 52.1, lng: 21 })).toMatchObject({ radiusM: 3000 });
    expect(parseRequest({ op: 'photo', name: PHOTO })).toEqual({ op: 'photo', name: PHOTO });
    for (const bad of [
      null,
      [],
      {},
      { op: 'x' },
      { op: 'search', q: 'a' },
      { op: 'search', q: 'x'.repeat(81) },
      { op: 'search', q: 'gym', lat: 100, lng: 0 },
      { op: 'search', q: 'gym', lat: 1 },
      { op: 'nearby', lat: 1 },
      { op: 'nearby' },
      { op: 'photo', name: 'places/../photos/x' },
      { op: 'photo', name: 'https://evil.example/x' },
    ]) {
      expect(() => parseRequest(bad)).toThrow();
    }
  });
});

describe('SPO-360 gymPlaces: consent', () => {
  it('needs the NEWEST geo-search record to be a grant of the current version that names Google', () => {
    expect(googleConsentOn([grant(10)], V)).toBe(true);
    expect(googleConsentOn([], V)).toBe(false);
    expect(googleConsentOn([grant(10, { action: 'withdraw' })], V)).toBe(false);
    expect(googleConsentOn([grant(10), grant(20, { action: 'withdraw' })], V)).toBe(false);
    expect(googleConsentOn([grant(20), grant(10, { action: 'withdraw' })], V)).toBe(true);
    expect(googleConsentOn([grant(10, { version: '2026-10-22' })], V)).toBe(false);
    expect(googleConsentOn([grant(10, { engines: ['photon'] })], V)).toBe(false);
    expect(googleConsentOn([grant(10, { kind: 'atlas-ai' })], V)).toBe(false);
  });

  it('refuses without consent and never calls Google', async () => {
    const { p, fetchMock } = ports({ records: async () => [] });
    expect(await code(gymPlacesHandler({ op: 'search', q: 'gym' }, p))).toBe(
      'permission-denied:no-consent',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an old-version grant (before Google was disclosed) is not enough', async () => {
    const { p, fetchMock } = ports({
      records: async () => [grant(10, { version: '2026-10-22', engines: ['photon', 'overpass'] })],
    });
    expect(await code(gymPlacesHandler({ op: 'nearby', lat: 1, lng: 1 }, p))).toContain(
      'no-consent',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('SPO-360 gymPlaces: what reaches Google', () => {
  it('search: only the text and an area, the key in a header, a minimal field mask', async () => {
    const { p, fetchMock } = ports();
    await gymPlacesHandler({ op: 'search', q: 'zdrofit', lat: 52.18, lng: 21.02 }, p);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://places.googleapis.com/v1/places:searchText');
    const h = (init as RequestInit).headers as Record<string, string>;
    expect(h['X-Goog-Api-Key']).toBe('k-secret');
    expect(h['X-Goog-FieldMask']).toBe(
      'places.id,places.displayName,places.location,places.formattedAddress,places.photos',
    );
    const body = JSON.parse(String((init as RequestInit).body));
    expect(Object.keys(body).sort()).toEqual(['locationBias', 'maxResultCount', 'textQuery']);
    expect(body.textQuery).toBe('zdrofit');
    expect(String(url)).not.toContain('k-secret');
  });

  it('nearby: gyms within the radius, nearest first, nothing else', async () => {
    const { p, fetchMock } = ports();
    await gymPlacesHandler({ op: 'nearby', lat: 52.18, lng: 21.02, radiusM: 3000 }, p);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://places.googleapis.com/v1/places:searchNearby');
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.rankPreference).toBe('DISTANCE');
    expect(body.locationRestriction.circle.radius).toBe(3000);
    expect(body.includedTypes).toContain('gym');
  });

  it('maps places to the minimum and drops rows without a name or a position', async () => {
    const { p } = ports({
      fetch: (async () =>
        json({
          places: [
            {
              id: 'A',
              displayName: { text: ' Zdrofit ' },
              location: { latitude: 52.1, longitude: 21.0 },
              formattedAddress: 'Bukowińska 22',
              photos: [{ name: PHOTO, authorAttributions: [{ displayName: 'Ola' }, {}] }],
              rating: 4.5,
            },
            { id: 'B', displayName: { text: 'No position' } },
            { id: 'C', location: { latitude: 1, longitude: 1 } },
            {
              id: 'D',
              displayName: { text: 'Bad photo' },
              location: { latitude: 1, longitude: 2 },
              photos: [{ name: 'x' }],
            },
          ],
        })) as unknown as typeof fetch,
    });
    expect(await gymPlacesHandler({ op: 'search', q: 'zdrofit' }, p)).toEqual({
      places: [
        {
          id: 'A',
          name: 'Zdrofit',
          lat: 52.1,
          lng: 21,
          address: 'Bukowińska 22',
          photoName: PHOTO,
          photoBy: ['Ola'],
        },
        { id: 'D', name: 'Bad photo', lat: 1, lng: 2 },
      ],
    });
    expect(mapPlaces(null)).toEqual([]);
  });

  it('a Google error is reported as unavailable (no body is passed on)', async () => {
    const { p } = ports({
      fetch: (async () =>
        json({ error: { message: 'secret detail' } }, 429)) as unknown as typeof fetch,
    });
    const r = await code(gymPlacesHandler({ op: 'search', q: 'gym' }, p));
    expect(r).toBe('unavailable:google-429');
    expect(r).not.toContain('secret detail');
  });

  it('fails closed when the key is not configured', async () => {
    const { p, fetchMock } = ports({ key: '' });
    expect(await code(gymPlacesHandler({ op: 'search', q: 'gym' }, p))).toBe(
      'failed-precondition:not-configured',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('SPO-360 gymPlaces: long photo references', () => {
  const LONG = `places/ChIJabc123/photos/${'AbC_-9'.repeat(110)}`; // 660 characters: real Places tokens are this long
  it('a long photo reference is accepted when asked for', () => {
    expect(parseRequest({ op: 'photo', name: LONG })).toEqual({ op: 'photo', name: LONG });
  });
  it('a long photo reference is passed on from a search result', () => {
    expect(
      mapPlaces({
        places: [
          {
            id: 'p1',
            displayName: { text: 'G' },
            location: { latitude: 1, longitude: 2 },
            photos: [{ name: LONG }],
          },
        ],
      })[0]?.photoName,
    ).toBe(LONG);
  });
});

describe('SPO-360 gymPlaces: photos', () => {
  const img = (bytes: number, type = 'image/jpeg') =>
    new Response(new Uint8Array(bytes), { status: 200, headers: { 'Content-Type': type } });

  it('returns the image as a data URL and asks Google for exactly that photo', async () => {
    const { p, fetchMock } = ports({
      fetch: vi.fn(async () => img(10)) as unknown as typeof fetch,
    });
    const out = await gymPlacesHandler({ op: 'photo', name: PHOTO }, p);
    expect(out).toEqual({ photo: expect.stringMatching(/^data:image\/jpeg;base64,/) });
    void fetchMock;
  });

  it('a non-image, an empty body, an oversized image or a Google error give no photo', async () => {
    for (const res of [
      img(10, 'text/html'),
      img(0),
      img(PHOTO_MAX_BYTES + 1),
      new Response('x', { status: 404 }),
    ]) {
      const { p } = ports({ fetch: (async () => res) as unknown as typeof fetch });
      expect(await gymPlacesHandler({ op: 'photo', name: PHOTO }, p)).toEqual({ photo: null });
    }
  });

  it('refuses a photo name that is not a Places photo reference (no request to arbitrary URLs)', async () => {
    const { p, fetchMock } = ports();
    expect(await code(gymPlacesHandler({ op: 'photo', name: 'https://evil.example/a' }, p))).toBe(
      'invalid-argument:bad-photo',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('SPO-590 gymPlaces: opening hours', () => {
  const P = (day: number, h: number, m: number) => ({ day, hour: h, minute: m });

  it('accepts the hours op only with a name and a position', () => {
    expect(parseRequest({ op: 'hours', q: ' Zdrofit ', lat: 52.1, lng: 21 })).toEqual({
      op: 'hours',
      q: 'Zdrofit',
      lat: 52.1,
      lng: 21,
    });
    expect(() => parseRequest({ op: 'hours', q: 'Z', lat: 1, lng: 1 })).toThrow('bad-query');
    expect(() => parseRequest({ op: 'hours', q: 'Zdrofit' })).toThrow('bad-position');
    expect(() => parseRequest({ op: 'hours', q: 'Zdrofit', lat: 200, lng: 1 })).toThrow(
      'bad-position',
    );
  });

  it('asks Google for hours only on the hours op, in a small area, and keeps search/nearby unchanged', () => {
    const h = googleRequest({ op: 'hours', q: 'Zdrofit', lat: 52.1, lng: 21 });
    expect(h.fieldMask).toContain('regularOpeningHours');
    expect(h.body).toMatchObject({ textQuery: 'Zdrofit' });
    expect(
      (h.body.locationBias as { circle: { radius: number } }).circle.radius,
    ).toBeLessThanOrEqual(500);
    expect(googleRequest({ op: 'search', q: 'gym' }).fieldMask).not.toContain('OpeningHours');
    expect(googleRequest({ op: 'nearby', lat: 1, lng: 1, radiusM: 1000 }).fieldMask).not.toContain(
      'OpeningHours',
    );
  });

  it('maps Google periods (Sunday = 0) to a Monday-first week', () => {
    const week = periodsToWeek([
      { open: P(1, 6, 0), close: P(1, 22, 30) }, // Monday
      { open: P(0, 8, 0), close: P(0, 20, 0) }, // Sunday
    ]);
    expect(week?.[0]).toEqual([[360, 1350]]);
    expect(week?.[6]).toEqual([[480, 1200]]);
    expect(week?.[1]).toEqual([]);
  });

  it('splits an overnight period at midnight and keeps "closes at 24:00" whole', () => {
    const night = periodsToWeek([{ open: P(5, 22, 0), close: P(6, 2, 0) }]); // Fri 22:00 → Sat 02:00
    expect(night?.[4]).toEqual([[1320, 1440]]);
    expect(night?.[5]).toEqual([[0, 120]]);
    const mid = periodsToWeek([{ open: P(2, 9, 0), close: P(3, 0, 0) }]); // Tue 09:00 → Wed 00:00
    expect(mid?.[1]).toEqual([[540, 1440]]);
    expect(mid?.[2]).toEqual([]);
  });

  it('reads a period that opens Sunday 00:00 and never closes as always open', () => {
    const all = periodsToWeek([{ open: P(0, 0, 0) }]);
    expect(all).toHaveLength(7);
    for (const d of all ?? []) expect(d).toEqual([[0, 1440]]);
  });

  it('orders two ranges of a day and gives null for nothing usable', () => {
    const split = periodsToWeek([
      { open: P(3, 16, 0), close: P(3, 21, 0) },
      { open: P(3, 7, 0), close: P(3, 12, 0) },
    ]);
    expect(split?.[2]).toEqual([
      [420, 720],
      [960, 1260],
    ]);
    expect(periodsToWeek(undefined)).toBeNull();
    expect(periodsToWeek([])).toBeNull();
    expect(
      periodsToWeek([{ open: P(9, 1, 1), close: P(1, 2, 2) }, { close: P(1, 2, 2) }]),
    ).toBeNull();
    expect(periodsToWeek([{ open: P(1, 9, 0), close: P(1, 8, 0) }])).toBeNull();
  });

  it('mapPlaces carries the week only when Google sent periods', () => {
    const rows = mapPlaces({
      places: [
        {
          id: 'a',
          displayName: { text: 'A' },
          location: { latitude: 1, longitude: 2 },
          regularOpeningHours: { periods: [{ open: P(1, 6, 0), close: P(1, 22, 0) }] },
        },
        { id: 'b', displayName: { text: 'B' }, location: { latitude: 1, longitude: 2 } },
      ],
    });
    expect(rows[0].hours?.[0]).toEqual([[360, 1320]]);
    expect(rows[1].hours).toBeUndefined();
  });

  it('is behind the same consent as everything else, and sends the hours request to Google', async () => {
    const none = ports({ records: async () => [] });
    expect(
      await code(gymPlacesHandler({ op: 'hours', q: 'Zdrofit', lat: 1, lng: 2 }, none.p)),
    ).toContain('permission-denied');
    expect(none.fetchMock).not.toHaveBeenCalled();
    const ok = ports();
    ok.fetchMock.mockResolvedValue(
      json({
        places: [
          {
            id: 'a',
            displayName: { text: 'Zdrofit' },
            location: { latitude: 1, longitude: 2 },
            regularOpeningHours: { periods: [{ open: P(1, 6, 0), close: P(1, 22, 0) }] },
          },
        ],
      }),
    );
    const out = (await gymPlacesHandler({ op: 'hours', q: 'Zdrofit', lat: 1, lng: 2 }, ok.p)) as {
      places: Array<{ hours?: unknown }>;
    };
    expect(out.places[0].hours).toBeTruthy();
    const init = ok.fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers['X-Goog-FieldMask']).toContain('regularOpeningHours');
  });
});
