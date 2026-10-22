import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import type { PlaceResult, ProviderId, ProviderState, SearchHandlers } from '../data/gymProviders';
import { emptyState, NOW, seed, setDesktop } from './__fixtures__/viewKit';
import { openGyms, setGeo } from './__fixtures__/gymsKit';
import { resetGeoGateForTests, setGeoSearchState } from '../data/geoSearchGate';

const m = vi.hoisted(() => ({
  search: vi.fn(),
  cache: vi.fn(),
  cacheAddress: vi.fn(),
  photo: vi.fn(),
}));
vi.mock('../data/gymProviders', async (orig) => ({
  ...(await orig<typeof import('../data/gymProviders')>()),
  resolveAddress: () => Promise.resolve(null),
  resolvePhoto: m.photo,
  searchGyms: m.search,
  readCache: m.cache,
  cacheAddress: m.cacheAddress,
}));

const place = (
  key: string,
  name: string,
  lat: number,
  lng: number,
  over: Partial<PlaceResult> = {},
): PlaceResult => ({
  key,
  name,
  lat,
  lng,
  sources: ['osm'],
  ...over,
});

/** The handlers of the most recent searchGyms call for `query`. */
const handlersFor = (query: string): SearchHandlers => {
  const call = [...m.search.mock.calls].reverse().find((c) => c[0] === query);
  if (!call) throw new Error(`no search for ${query}`);
  return call[5] as SearchHandlers;
};
const input = () => screen.getByPlaceholderText(en.searchGymPlaceholder);
const type = (v: string) => fireEvent.change(input(), { target: { value: v } });
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  // Gym search and maps are gated on the geo-search consent (SPO-293): these cases run with it granted.
  resetGeoGateForTests();
  setGeoSearchState({ on: true, ready: true, answered: true });
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  setLocale('en');
  localStorage.clear();
  setDesktop(false);
  setGeo('denied');
  m.search.mockReset().mockResolvedValue(undefined);
  m.cache.mockReset().mockReturnValue(null);
  m.cacheAddress.mockReset();
  m.photo.mockReset().mockResolvedValue(null);
  seed(emptyState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GymsView search: query handling', () => {
  it('one character does nothing: no chips, no manual row, no search', async () => {
    const { container } = openGyms();
    type('a');
    await tick(1000);
    expect(container.querySelector('.provider-chips')).toBeNull();
    expect(screen.queryByText(en.imHere)).toBeNull();
    expect(m.search).not.toHaveBeenCalled();
  });

  it('debounces: only the last keystroke within 350 ms is searched', async () => {
    openGyms();
    type('ir');
    await tick(200);
    type('iro');
    await tick(349);
    expect(m.search).not.toHaveBeenCalled();
    await tick(1);
    expect(m.search).toHaveBeenCalledTimes(1);
    expect(m.search.mock.calls[0][0]).toBe('iro');
  });

  it('shows one chip per provider, pending until each answers, then count / dash', async () => {
    const { container } = openGyms();
    type('iron');
    await tick(400);
    const chips = () => [...container.querySelectorAll('.provider-chip')];
    expect(chips().map((c) => c.className)).toEqual([
      'provider-chip pending',
      'provider-chip pending',
      'provider-chip pending',
      'provider-chip pending',
    ]);
    const h = handlersFor('iron');
    const states: Array<[ProviderId, ProviderState]> = [
      ['local', { status: 'answered', count: 3 }],
      ['osm', { status: 'failed', reason: 'x' }],
      ['google', { status: 'skipped', reason: 'no key' }],
    ];
    act(() => states.forEach(([id, st]) => h.onProvider(id, st)));
    expect(chips()[0].textContent).toContain('3');
    expect(chips()[0].className).toContain('answered');
    expect(chips()[1].textContent).toContain('—');
    expect(chips()[2].className).toContain('skipped');
    expect(chips()[3].className).toContain('pending');
  });

  it('results are highlighted by subsequence and a stale search is ignored once the query changes', async () => {
    const { container } = openGyms();
    type('portlife');
    await tick(400);
    const old = handlersFor('portlife');
    act(() => old.onResults([place('a', 'Sportlife Vilnius', 1, 1)]));
    const hl = [...container.querySelectorAll('.gym-result .name .hl')].map((n) => n.textContent);
    expect(hl.join('')).toBe('portlife');
    type('other');
    await tick(400);
    act(() => old.onResults([place('b', 'Stale Gym', 1, 1)]));
    expect(screen.queryByText('Stale Gym')).toBeNull();
  });

  it('empty result with every provider answered shows the manual-add hint, not before', async () => {
    openGyms();
    type('zzz');
    await tick(400);
    expect(screen.queryByText(en.searchGymEmpty)).toBeNull();
    const h = handlersFor('zzz');
    act(() => {
      (['local', 'osm', 'google', 'foursquare'] as ProviderId[]).forEach((id) =>
        h.onProvider(
          id,
          id === 'google' ? { status: 'skipped', reason: 'k' } : { status: 'answered', count: 0 },
        ),
      );
      h.onResults([]);
    });
    expect(screen.getByText(en.searchGymEmpty)).toBeTruthy();
  });

  it('skeleton rows appear after 300 ms without a cache hit, and vanish at the first results', async () => {
    const { container } = openGyms();
    type('iron');
    await tick(400);
    expect(container.querySelectorAll('.gym-result.skeleton')).toHaveLength(3);
    act(() => handlersFor('iron').onResults([place('a', 'Iron One', 1, 1)]));
    expect(container.querySelectorAll('.gym-result.skeleton')).toHaveLength(0);
    expect(container.querySelector('.gym-result:not(.manual) .name')?.textContent).toBe('Iron One');
  });

  it('a cached answer is shown straight away and no skeleton appears', async () => {
    m.cache.mockReturnValue([place('c', 'Cached Gym', 1, 1)]);
    const { container } = openGyms();
    type('cached');
    await tick(400);
    expect(container.querySelectorAll('.gym-result.skeleton')).toHaveLength(0);
    expect(container.querySelector('.gym-result .name')?.textContent).toBe('Cached Gym');
  });

  it('manual row echoes the query; click asks to locate with the trimmed text', async () => {
    setGeo({ lat: 10, lng: 20, accuracy: 5 });
    openGyms();
    type(' Basement ');
    await tick(10);
    expect(screen.getByText('«Basement»')).toBeTruthy();
    fireEvent.click(screen.getByText(en.imHere).closest('button')!);
    await act(async () => undefined);
    expect(screen.queryByText('«Basement»')).toBeTruthy();
  });
});

describe('GymsView search: picking and ordering', () => {
  it('sorts results nearest-first once the position is known, with distance and address', async () => {
    setGeo({ lat: 0, lng: 0, accuracy: 5 });
    const { container } = openGyms();
    await tick(0);
    type('gym');
    await tick(400);
    act(() =>
      handlersFor('gym').onResults([
        place('far', 'Far Gym', 0.1, 0.1, { address: 'Far St' }),
        place('near', 'Near Gym', 0.001, 0, {}),
      ]),
    );
    const rows = [...container.querySelectorAll('.gym-result:not(.manual)')];
    expect(rows.map((r) => r.querySelector('.name')?.textContent)).toEqual(['Near Gym', 'Far Gym']);
    expect(rows[0].querySelector('.addr')?.textContent).toBe('110 m');
    expect(rows[1].querySelector('.addr')?.textContent).toMatch(/^\d+\.\d km · Far St$/);
  });

  it('keeps provider order and shows only the address when the position is unknown', async () => {
    const { container } = openGyms();
    type('gym');
    await tick(400);
    act(() =>
      handlersFor('gym').onResults([
        place('b', 'B Gym', 5, 5, { address: 'B St' }),
        place('a', 'A Gym', 1, 1),
      ]),
    );
    const rows = [...container.querySelectorAll('.gym-result:not(.manual)')];
    expect(rows.map((r) => r.querySelector('.name')?.textContent)).toEqual(['B Gym', 'A Gym']);
    expect(rows[0].querySelector('.addr')?.textContent).toBe('B St');
    expect(rows[1].querySelector('.addr')).toBeNull();
  });

  it('picking a result opens its page with address, external id and amenities, caching the address', async () => {
    const { container, shell } = openGyms();
    type('gym');
    await tick(400);
    act(() =>
      handlersFor('gym').onResults([
        place('a', 'A Gym', 1.5, 2.5, {
          address: 'A St',
          externalId: 'osm:9',
          amenities: ['sauna'],
        }),
        place('n', 'No Addr', 3, 3),
      ]),
    );
    fireEvent.click(container.querySelectorAll('.gym-result:not(.manual)')[0]);
    expect(m.cacheAddress).toHaveBeenCalledWith(1.5, 2.5, 'A St');
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'gym',
      name: 'A Gym',
      lat: 1.5,
      lng: 2.5,
      address: 'A St',
      externalId: 'osm:9',
      amenities: ['sauna'],
    });
    fireEvent.click(container.querySelectorAll('.gym-result:not(.manual)')[1]);
    expect(m.cacheAddress).toHaveBeenCalledTimes(1);
  });

  it('thumbnails fall back from photo to map tile to the house graphic when images fail', async () => {
    const { container } = openGyms();
    type('gym');
    await tick(400);
    act(() =>
      handlersFor('gym').onResults([
        place('a', 'A Gym', 1, 1, { photoUrl: 'https://img.example/a.jpg' }),
      ]),
    );
    const img = () => container.querySelector('.gym-result .thumb img') as HTMLImageElement | null;
    expect(img()?.src).toBe('https://img.example/a.jpg');
    fireEvent.error(img()!);
    expect(img()?.src).toContain('tile');
    fireEvent.error(img()!);
    expect(img()).toBeNull();
    expect(
      container.querySelector('.gym-result .thumb svg, .gym-result .thumb [class*="house"]'),
    ).not.toBeNull();
  });

  it('a resolved photo replaces the tile; lookups happen once per venue', async () => {
    m.photo.mockResolvedValue('https://img.example/resolved.jpg');
    const { container } = openGyms();
    type('gym');
    await tick(400);
    act(() => handlersFor('gym').onResults([place('a', 'A Gym', 1, 1)]));
    await tick(0);
    expect((container.querySelector('.gym-result .thumb img') as HTMLImageElement).src).toBe(
      'https://img.example/resolved.jpg',
    );
    act(() => handlersFor('gym').onResults([place('a', 'A Gym', 1, 1)]));
    expect(m.photo).toHaveBeenCalledTimes(1);
  });

  it('a failing photo lookup is swallowed', async () => {
    m.photo.mockRejectedValue(new Error('net'));
    const { container } = openGyms();
    type('gym');
    await tick(400);
    act(() => handlersFor('gym').onResults([place('a', 'A Gym', 1, 1)]));
    await tick(0);
    expect(container.querySelector('.gym-result .name')?.textContent).toBe('A Gym');
  });
});

describe('GymsView search: nearby suggestions', () => {
  it('searches the locale term around me and lists the five closest unsaved gyms', async () => {
    setGeo({ lat: 0, lng: 0, accuracy: 5 });
    seed({
      ...emptyState(),
      gyms: [{ id: 's', name: 'Saved', lat: 0.0002, lng: 0, radiusM: 100 }],
    } as never);
    const { container } = openGyms();
    await tick(0);
    expect(m.search).toHaveBeenCalledWith(
      en.nearbyQuery,
      { lat: 0, lng: 0 },
      expect.anything(),
      expect.any(Array),
      expect.anything(),
      expect.anything(),
    );
    const lst = Array.from({ length: 7 }, (_, i) =>
      place(`p${i}`, `Gym ${i}`, (i + 1) * 0.001, 0, { address: i === 0 ? 'Zero St' : undefined }),
    );
    act(() =>
      handlersFor(en.nearbyQuery).onResults([
        ...lst.reverse(),
        place('dup', 'Saved Twin', 0.0003, 0),
      ]),
    );
    expect(screen.getByText(en.nearbyGyms)).toBeTruthy();
    const names = [...container.querySelectorAll('.gym-result .name')].map((n) => n.textContent);
    expect(names).toEqual(['Gym 0', 'Gym 1', 'Gym 2', 'Gym 3', 'Gym 4']);
    expect(container.querySelector('.gym-result .addr')?.textContent).toBe('110 m · Zero St');
  });

  it('picking a nearby gym opens it; typing hides the nearby list', async () => {
    setGeo({ lat: 0, lng: 0, accuracy: 5 });
    const { container, shell } = openGyms();
    await tick(0);
    act(() => handlersFor(en.nearbyQuery).onResults([place('p', 'Close Gym', 0.001, 0)]));
    fireEvent.click(container.querySelector('.gym-result')!);
    expect(shell.openOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ screen: 'gym', name: 'Close Gym' }),
    );
    type('xy');
    expect(screen.queryByText(en.nearbyGyms)).toBeNull();
  });

  it('no nearby search without a position', async () => {
    openGyms();
    await tick(500);
    expect(m.search).not.toHaveBeenCalled();
    expect(screen.queryByText(en.nearbyGyms)).toBeNull();
  });
});

describe('GymsView search: without the geo-search consent (SPO-293)', () => {
  it('shows the "Gym search is off" notice and searches nothing, however much is typed', async () => {
    resetGeoGateForTests();
    setGeo({ lat: 0, lng: 0, accuracy: 5 });
    const { container } = openGyms();
    type('iron');
    await tick(1000);
    expect(screen.getByText('Gym search is off')).toBeTruthy();
    expect(m.search).not.toHaveBeenCalled();
    expect(container.querySelector('.provider-chips')).toBeNull();
  });
});
