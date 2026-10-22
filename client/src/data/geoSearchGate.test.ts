import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GEO_ENGINES,
  GeoConsentError,
  assertGeoSearchOn,
  resetGeoGateForTests,
  geoSignal,
  isGeoSearchOn,
  setGeoOverride,
  setGeoSearchState,
} from './geoSearchGate';
import {
  brandLogo,
  googleLookup,
  resolveAddress,
  resolveGymMeta,
  resolvePhoto,
  searchGyms,
  searchNearbyGyms,
  type ProviderId,
  type ProviderState,
} from './gymProviders';
import type { Gym } from '../types';

/** SPO-293: no consent, no request to any map or place service. */

const coords = { lat: 50.45, lng: 30.52 };
const saved = { id: 'g1', name: 'Home Gym', lat: 50.4501, lng: 30.5201, radiusM: 100 } as Gym;
let fetchSpy: ReturnType<typeof vi.fn>;

const on = () => setGeoSearchState({ on: true, ready: true, answered: true });
const hosts = () => fetchSpy.mock.calls.map((c) => new URL(String(c[0])).host);

beforeEach(() => {
  localStorage.clear();
  resetGeoGateForTests();
  fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('with no consent', () => {
  it('assertGeoSearchOn refuses', () => {
    expect(() => assertGeoSearchOn()).toThrow(GeoConsentError);
  });

  it('searchGyms sends nothing to any provider and still lists the saved gyms', async () => {
    const states: Partial<Record<ProviderId, ProviderState>> = {};
    const rows = await searchGyms(
      'home',
      coords,
      { googlePlaces: 'k', foursquare: 'k' },
      [saved],
      new AbortController().signal,
      { onResults: () => undefined, onProvider: (id, s) => (states[id] = s) },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(rows.map((r) => r.name)).toEqual(['Home Gym']);
    expect(states.osm?.status).toBe('skipped');
  });

  it('searchNearbyGyms (Overpass) sends nothing and returns the saved gyms only', async () => {
    const rows = await searchNearbyGyms(coords, 3000, [saved], new AbortController().signal);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(rows.map((r) => r.name)).toEqual(['Home Gym']);
  });

  it('photos, logos (Wikidata, Commons), addresses (Photon) and hours (Nominatim) send nothing', async () => {
    const sig = new AbortController().signal;
    const place = {
      key: 'k',
      name: 'McFit',
      lat: 1,
      lng: 2,
      wikimediaCommons: 'File:A.jpg',
      brandWikidata: 'Q1',
      sources: ['osm' as const],
    };
    await expect(resolvePhoto(place, sig)).resolves.toBeNull();
    await expect(brandLogo('McFit', sig)).resolves.toBeNull();
    await expect(resolveAddress(1, 2, sig)).resolves.toBeNull();
    await expect(resolveGymMeta(1, 2, sig, 'McFit')).resolves.toBeNull();
    await expect(googleLookup('McFit', 1, 2, sig)).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not poison the logo / address / hours caches, so a later consent still resolves', async () => {
    const sig = new AbortController().signal;
    await brandLogo('McFit', sig);
    await resolveAddress(1, 2, sig);
    await resolveGymMeta(1, 2, sig);
    expect(Object.keys(localStorage)).toEqual([]);
  });
});

describe('with consent', () => {
  beforeEach(on);

  it('calls only the OpenStreetMap-based services; Google Places and Foursquare are never called, even with keys', async () => {
    await searchGyms(
      'home',
      coords,
      { googlePlaces: 'k', foursquare: 'k' },
      [saved],
      new AbortController().signal,
      { onResults: () => undefined, onProvider: () => undefined },
    );
    expect(fetchSpy).toHaveBeenCalled();
    expect(new Set(hosts())).toEqual(new Set(['photon.komoot.io']));
  });

  it('Overpass and Nominatim are called for nearby gyms and hours', async () => {
    await searchNearbyGyms(coords, 3000, [], new AbortController().signal);
    await resolveGymMeta(3, 4, new AbortController().signal, 'Gym');
    expect(new Set(hosts())).toEqual(new Set(['overpass-api.de', 'nominatim.openstreetmap.org']));
  });

  it('the logo lookup uses Wikidata only (no Clearbit, no DuckDuckGo)', async () => {
    await brandLogo('Some Brand', new AbortController().signal);
    expect(new Set(hosts())).toEqual(new Set(['www.wikidata.org']));
  });

  it('records the real services as the consent engines', () => {
    expect([...GEO_ENGINES]).toEqual([
      'photon',
      'overpass',
      'nominatim',
      'osrm',
      'osm-tiles',
      'wikidata',
      'wikimedia-commons',
      'unpkg',
    ]);
  });

  it('withdrawing stops the very next call', async () => {
    const sig = new AbortController().signal;
    await resolveAddress(5, 6, sig);
    const before = fetchSpy.mock.calls.length;
    expect(before).toBeGreaterThan(0);
    setGeoSearchState({ on: false, ready: true, answered: true });
    await expect(resolveAddress(7, 8, sig)).resolves.toBeNull();
    expect(fetchSpy.mock.calls.length).toBe(before);
  });
});

describe('a withdrawal on this device is immediate (local override)', () => {
  it('stops sending and aborts the signal before the record arrives; a stale snapshot cannot undo it', () => {
    on();
    const sig = geoSignal();
    expect(isGeoSearchOn()).toBe(true);
    setGeoOverride(false);
    expect(isGeoSearchOn()).toBe(false);
    expect(sig.aborted).toBe(true);
    // A cached / stale snapshot still says on: the override holds.
    setGeoSearchState({ on: true, ready: true, answered: true, confirmed: false });
    expect(isGeoSearchOn()).toBe(false);
    setGeoSearchState({ on: true, ready: true, answered: true, confirmed: true });
    expect(isGeoSearchOn()).toBe(false);
    // The records catch up: the override is dropped and a later grant works again with a fresh signal.
    setGeoSearchState({ on: false, ready: true, answered: true, confirmed: true });
    setGeoSearchState({ on: true, ready: true, answered: true, confirmed: true });
    expect(isGeoSearchOn()).toBe(true);
    expect(geoSignal().aborted).toBe(false);
  });

  it('cancels a request already in flight', async () => {
    on();
    let seen: AbortSignal | undefined;
    fetchSpy.mockImplementation(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          seen = init?.signal ?? undefined;
          seen?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
        }),
    );
    const pending = resolveAddress(9, 9, new AbortController().signal);
    await Promise.resolve();
    expect(seen).toBeDefined();
    setGeoOverride(false);
    expect(seen?.aborted).toBe(true);
    await expect(pending).resolves.toBeNull();
  });

  it('a true override is dropped when the server confirms off', () => {
    setGeoSearchState({ on: false, ready: true, answered: true, confirmed: false });
    setGeoOverride(true);
    expect(isGeoSearchOn()).toBe(true);
    setGeoSearchState({ on: false, ready: true, answered: true, confirmed: true });
    expect(isGeoSearchOn()).toBe(false);
  });
});
