/** SPO-360: Google Places comes only through our `gymPlaces` function, only with consent, and never breaks the rest. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ callFn: vi.fn() }));
vi.mock('../api', () => ({ callFn: m.callFn }));

import {
  resolvePhotoInfo,
  searchGyms,
  searchNearbyGymsMerged,
  type PlaceResult,
  type ProviderId,
  type ProviderState,
} from './gymProviders';
import { resetGeoGateForTests, setGeoSearchState } from './geoSearchGate';

const KYIV = { lat: 50.45, lng: 30.52 };
const ROW = {
  id: 'g1',
  name: 'Google Gym',
  lat: 50.451,
  lng: 30.521,
  address: 'Khreshchatyk 1',
  photoName: 'places/g1/photos/abc',
  photoBy: ['Ann'],
};

beforeEach(() => {
  resetGeoGateForTests();
  setGeoSearchState({ on: true, ready: true, answered: true });
  m.callFn.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 502 })),
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function run(query = 'gym') {
  const states: Partial<Record<ProviderId, ProviderState>> = {};
  const merged = await searchGyms(query, KYIV, [], new AbortController().signal, {
    onResults: () => {},
    onProvider: (id, st) => {
      states[id] = st;
    },
  });
  return { merged, states };
}

describe('Google provider (via gymPlaces)', () => {
  it('asks our function, never Google directly, and marks results as google', async () => {
    m.callFn.mockResolvedValue({ places: [ROW] });
    const { merged, states } = await run('Google Gym');
    expect(m.callFn).toHaveBeenCalledWith(
      'gymPlaces',
      { op: 'search', q: 'Google Gym', lat: KYIV.lat, lng: KYIV.lng },
      { quiet: true },
    );
    const urls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) =>
      String(c[0]),
    );
    expect(urls.some((u) => u.includes('googleapis.com'))).toBe(false);
    const g = merged.find((r) => r.sources.includes('google'));
    expect(g?.googlePhotoName).toBe('places/g1/photos/abc');
    expect(states.google).toEqual({ status: 'answered', count: 1 });
  });

  it('without consent nothing is sent to the function', async () => {
    setGeoSearchState({ on: false, ready: true, answered: true });
    const { states } = await run();
    expect(m.callFn).not.toHaveBeenCalled();
    expect(states.google?.status).toBe('skipped');
  });

  it('server says no-consent or not-configured → skipped, other providers unaffected', async () => {
    m.callFn.mockRejectedValue(new Error('no-consent'));
    expect((await run()).states.google?.status).toBe('skipped');
    m.callFn.mockRejectedValue(new Error('not-configured'));
    expect((await run()).states.google?.status).toBe('skipped');
  });

  it('a Google outage is a failed chip, not an exception', async () => {
    m.callFn.mockRejectedValue(new Error('google-500'));
    const { states } = await run();
    expect(states.google?.status).toBe('failed');
  });

  it('nearby merges Google results even when the other services are down', async () => {
    m.callFn.mockResolvedValue({ places: [ROW] });
    const rows = await searchNearbyGymsMerged(
      KYIV,
      3000,
      'gym',
      [],
      new AbortController().signal,
      () => {},
    );
    expect(m.callFn).toHaveBeenCalledWith(
      'gymPlaces',
      { op: 'nearby', lat: KYIV.lat, lng: KYIV.lng, radiusM: 3000 },
      { quiet: true },
    );
    expect(rows.map((r) => r.name)).toContain('Google Gym');
  });

  it('photo comes through the proxy with a Google credit', async () => {
    m.callFn.mockResolvedValue({ photo: 'data:image/jpeg;base64,AAAA' });
    const r = {
      key: 'k',
      name: 'x',
      lat: 0,
      lng: 0,
      sources: ['google'],
      googlePhotoName: ROW.photoName,
      googlePhotoBy: ['Ann'],
    } as PlaceResult;
    const p = await resolvePhotoInfo(r, new AbortController().signal);
    expect(p?.url).toBe('data:image/jpeg;base64,AAAA');
    expect(p?.credit?.author).toBe('Ann (Google)');
  });

  it('photo is not requested without consent', async () => {
    setGeoSearchState({ on: false, ready: true, answered: true });
    const r = {
      key: 'k',
      name: 'x',
      lat: 0,
      lng: 0,
      sources: ['google'],
      googlePhotoName: ROW.photoName,
    } as PlaceResult;
    expect(await resolvePhotoInfo(r, new AbortController().signal)).toBeNull();
    expect(m.callFn).not.toHaveBeenCalled();
  });
});
