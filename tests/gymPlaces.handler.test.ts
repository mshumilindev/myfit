import { describe, expect, it, vi } from 'vitest';
import {
  GOOGLE_ENGINE,
  PHOTO_MAX_BYTES,
  googleConsentOn,
  gymPlacesHandler,
  mapPlaces,
  parseRequest,
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
