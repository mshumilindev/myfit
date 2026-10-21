import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { PlaceResult } from '../data/gymProviders';
import type { Gym } from '../types';

const getPos = vi.fn();
const upsertGym = vi.fn();
const searchNearby = vi.fn();
const resolveMeta = vi.fn();
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  getCurrentPositionOnce: (...a: unknown[]) => getPos(...a),
  upsertGym: (...a: unknown[]) => upsertGym(...a),
}));
vi.mock('../data/gymProviders', async (orig) => ({
  ...(await orig<typeof import('../data/gymProviders')>()),
  searchNearbyGyms: (...a: unknown[]) => searchNearby(...a),
  resolveGymMeta: (...a: unknown[]) => resolveMeta(...a),
}));
vi.mock('./GymThumb', () => ({ GymThumb: () => <span data-testid="thumb" /> }));

import { GymPicker, suggestGymId } from './GymPicker';

const gym = (id: string, name: string, lat: number, lng: number, over: Partial<Gym> = {}): Gym => ({
  id,
  name,
  lat,
  lng,
  radiusM: 100,
  ...over,
});
// ~ 0.001 deg lat = 111 m
const NEAR = gym('near', 'Near Gym', 50.0, 14.0);
const FAR = gym('far', 'Far Gym', 50.05, 14.0);
const place = (over: Partial<PlaceResult> = {}): PlaceResult =>
  ({
    key: 'p1',
    name: 'New Place',
    lat: 50.02,
    lng: 14.0,
    sources: ['osm'],
    ...over,
  }) as PlaceResult;

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

beforeEach(() => {
  setLocale('en');
  getPos.mockReset();
  getPos.mockResolvedValue({ lat: 50.0, lng: 14.0, accuracy: 5 });
  upsertGym.mockReset();
  searchNearby.mockReset();
  searchNearby.mockResolvedValue([]);
  resolveMeta.mockReset();
  resolveMeta.mockResolvedValue(null);
  __replaceStateForTests({ ...__getStateForTests(), workouts: [] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('suggestGymId', () => {
  it('prefers a gym whose own radius contains the position', () => {
    const wide = gym('wide', 'Wide', 50.0, 14.0005, { radiusM: 500 });
    expect(suggestGymId([FAR, wide, NEAR], { lat: 50.0, lng: 14.0 })).toBe('near');
    expect(suggestGymId([FAR, wide], { lat: 50.0, lng: 14.0 })).toBe('wide');
  });

  it('a nearer gym that is outside its own radius loses to a farther one that contains you', () => {
    const outside = gym('outside', 'Outside', 50.00135, 14.0, { radiusM: 100 }); // ~150 m away
    const inside = gym('inside', 'Inside', 50.00225, 14.0, { radiusM: 300 }); // ~250 m away
    expect(suggestGymId([outside, inside], { lat: 50.0, lng: 14.0 })).toBe('inside');
    expect(suggestGymId([outside], { lat: 50.0, lng: 14.0 })).toBe('outside'); // still the nearest fallback
  });

  it('falls back to the nearest overall, then to the first saved, then null', () => {
    expect(suggestGymId([FAR, NEAR], { lat: 50.02, lng: 14.0 })).toBe('near');
    expect(suggestGymId([FAR, NEAR], null)).toBe('far');
    expect(suggestGymId([], { lat: 1, lng: 1 })).toBeNull();
    expect(suggestGymId([], null)).toBeNull();
  });
});

describe('GymPicker', () => {
  const base = { title: 'Where?', onPick: () => undefined, onClose: () => undefined };

  it('lists gyms nearest first, marks the suggestion and shows distances', async () => {
    render(<GymPicker {...base} gyms={[FAR, NEAR]} />);
    await flush();
    const rows = [...document.querySelectorAll('.gym-pick-list > *')];
    expect(rows[0].textContent).toContain('Near Gym');
    expect(rows[0].textContent).toContain("You're here");
    expect(rows[0].textContent).toContain('Suggested');
    expect(rows[1].textContent).toContain('Far Gym');
    expect(rows[1].textContent).toMatch(/5\.6 km/);
    expect(screen.getByText('Where?')).toBeTruthy();
  });

  it('shows the distance (not "here") beyond 40 m', async () => {
    getPos.mockResolvedValue({ lat: 50.0006, lng: 14.0, accuracy: 5 }); // ~67 m
    render(<GymPicker {...base} gyms={[NEAR]} />);
    await flush();
    expect(screen.queryByText("You're here")).toBeNull();
    expect(document.querySelector('.gym-pick-list')!.textContent).toMatch(/70 m/);
  });

  it('works without a position (no distances, first gym suggested)', async () => {
    getPos.mockRejectedValue(new Error('denied'));
    render(<GymPicker {...base} gyms={[FAR, NEAR]} />);
    await flush();
    const rows = [...document.querySelectorAll('.gym-pick-list > *')];
    expect(rows[0].textContent).toContain('Far Gym');
    expect(rows[0].textContent).toContain('Suggested');
    expect(rows[0].textContent).not.toMatch(/km| m$/);
    expect(screen.getByText('Allow location to see gyms near you')).toBeTruthy();
  });

  it('puts main (favourite) gyms first and tags them', async () => {
    const fav = gym('fav', 'Fav Gym', 50.5, 14.0, { favorite: true });
    render(<GymPicker {...base} gyms={[NEAR, fav]} />);
    await flush();
    const rows = [...document.querySelectorAll('.gym-pick-list > *')];
    expect(rows[0].textContent).toContain('Fav Gym');
    expect(rows[0].textContent).toContain('Main');
  });

  it('picks a gym and the "without a gym" option', async () => {
    const onPick = vi.fn();
    render(<GymPicker {...base} onPick={onPick} gyms={[NEAR]} />);
    await flush();
    fireEvent.click(screen.getByText('Near Gym'));
    expect(onPick).toHaveBeenLastCalledWith('near');
    fireEvent.click(screen.getByText('Without a gym'));
    expect(onPick).toHaveBeenLastCalledWith(null);
  });

  it('shows the search box only with more than four gyms, and filters by name', async () => {
    const few = render(<GymPicker {...base} gyms={[NEAR, FAR]} />);
    await flush();
    expect(few.container.ownerDocument.querySelector('input[type="search"], input')).toBeNull();
    few.unmount();
    const many = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega'].map((n, i) =>
      gym(`g${i}`, `${n} Fitness`, 50 + i / 100, 14),
    );
    render(<GymPicker {...base} gyms={many} />);
    await flush();
    const input = screen.getByPlaceholderText('Search for a gym');
    fireEvent.change(input, { target: { value: 'gam' } });
    expect(document.querySelector('.gym-pick-list')!.textContent).toContain('Gamma Fitness');
    expect(document.querySelector('.gym-pick-list')!.textContent).not.toContain('Alpha Fitness');
    // no "suggested" while searching
    expect(document.querySelector('.gym-pick-list')!.textContent).not.toContain('Suggested');
  });

  it('inline variant has no sheet, no nearby section and never searches nearby', async () => {
    render(<GymPicker {...base} gyms={[NEAR]} variant="inline" />);
    await flush();
    expect(document.querySelector('.gym-pick-inline')).toBeTruthy();
    expect(screen.queryByText('Gyms nearby')).toBeNull();
    expect(searchNearby).not.toHaveBeenCalled();
  });

  it('lists unsaved nearby gyms (not local, not within 60 m of a saved one) and saves the pick', async () => {
    const onPick = vi.fn();
    upsertGym.mockReturnValue({ id: 'saved-1' });
    searchNearby.mockResolvedValue([
      place({
        key: 'a',
        name: 'Fresh Gym',
        lat: 50.02,
        address: '1 Main St',
        externalId: 'osm:1',
        amenities: ['pool'],
      } as never),
      place({ key: 'b', name: 'Local Dupe', sources: ['local'] }),
      place({ key: 'c', name: 'Too Close', lat: 50.0002 }),
    ]);
    render(<GymPicker {...base} onPick={onPick} gyms={[NEAR]} />);
    await flush();
    expect(screen.getByText('Fresh Gym')).toBeTruthy();
    expect(screen.queryByText('Local Dupe')).toBeNull();
    expect(screen.queryByText('Too Close')).toBeNull();
    expect(document.body.textContent).toContain('1 Main St');
    fireEvent.click(screen.getByText('Fresh Gym'));
    expect(upsertGym).toHaveBeenCalledWith({
      name: 'Fresh Gym',
      lat: 50.02,
      lng: 14.0,
      radiusM: expect.any(Number),
      externalId: 'osm:1',
      amenitiesAuto: ['pool'],
    });
    expect(onPick).toHaveBeenCalledWith('saved-1');
  });

  it('saves a nearby place without optional provider fields', async () => {
    upsertGym.mockReturnValue({ id: 's2' });
    searchNearby.mockResolvedValue([place({ name: 'Plain' })]);
    render(<GymPicker {...base} gyms={[NEAR]} />);
    await flush();
    fireEvent.click(screen.getByText('Plain'));
    const arg = upsertGym.mock.calls[0][0];
    expect(arg).not.toHaveProperty('externalId');
    expect(arg).not.toHaveProperty('amenitiesAuto');
  });

  it('reports no nearby gyms, and treats a failed search the same', async () => {
    render(<GymPicker {...base} gyms={[NEAR]} />);
    await flush();
    expect(screen.getByText('No other gyms found nearby')).toBeTruthy();
    cleanup();
    searchNearby.mockRejectedValue(new Error('offline'));
    render(<GymPicker {...base} gyms={[NEAR]} />);
    await flush();
    expect(screen.getByText('No other gyms found nearby')).toBeTruthy();
  });

  it('shows "looking around" until the search resolves', async () => {
    let resolve: (v: PlaceResult[]) => void = () => undefined;
    searchNearby.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<GymPicker {...base} gyms={[NEAR]} />);
    await flush();
    expect(screen.getByText('Looking around you…')).toBeTruthy();
    await act(async () => resolve([]));
    expect(screen.queryByText('Looking around you…')).toBeNull();
  });

  it('filters nearby results with the search box', async () => {
    searchNearby.mockResolvedValue([
      place({ key: 'a', name: 'Alpha Club' }),
      place({ key: 'b', name: 'Beta Club' }),
    ]);
    render(<GymPicker {...base} gyms={[NEAR]} />);
    await flush();
    fireEvent.change(screen.getByPlaceholderText('Search for a gym'), {
      target: { value: 'beta' },
    });
    expect(screen.queryByText('Alpha Club')).toBeNull();
    expect(screen.getByText('Beta Club')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Search for a gym'), { target: { value: 'zzz' } });
    expect(screen.getByText('No other gyms found nearby')).toBeTruthy();
  });

  it('ignores a position that arrives after unmount', async () => {
    let resolve: (v: unknown) => void = () => undefined;
    getPos.mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = render(<GymPicker {...base} gyms={[NEAR]} />);
    unmount();
    await act(async () => resolve({ lat: 1, lng: 2, accuracy: 1 }));
    expect(searchNearby).not.toHaveBeenCalled();
  });
});

describe('GymPicker · opening hours', () => {
  const base = { title: 'Where?', onPick: () => undefined, onClose: () => undefined };
  const week = (ranges: Array<[number, number]>) => ({
    week: Array.from({ length: 7 }, () => ranges),
  });

  async function renderAt(hours: unknown, h = 12, m = 0) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 30, h, m)); // Wed
    resolveMeta.mockResolvedValue(hours);
    render(<GymPicker {...base} gyms={[NEAR]} variant="inline" />);
    await flush();
  }

  it("marks the gym open and shows today's range", async () => {
    await renderAt({ hours: week([[360, 1320]]) });
    const el = document.querySelector('.row-hours')!;
    expect(el.classList.contains('open')).toBe(true);
    expect(el.textContent).toBe('06:00–22:00');
  });

  it('marks it closed outside the range (computed locally, not from provider openNow)', async () => {
    await renderAt({ hours: week([[360, 1320]]), openNow: true }, 23, 0);
    expect(document.querySelector('.row-hours')!.classList.contains('open')).toBe(false);
  });

  it('handles ranges that wrap past midnight', async () => {
    await renderAt({ hours: week([[1200, 120]]) }, 1, 30);
    expect(document.querySelector('.row-hours')!.classList.contains('open')).toBe(true);
    expect(document.querySelector('.row-hours')!.textContent).toBe('20:00–02:00');
  });

  it('joins split ranges and says Closed on a day without hours', async () => {
    await renderAt({
      hours: week([
        [360, 600],
        [900, 1260],
      ]),
    });
    expect(document.querySelector('.row-hours')!.textContent).toBe('06:00–10:00, 15:00–21:00');
    cleanup();
    await renderAt({ hours: week([]) });
    expect(document.querySelector('.row-hours')!.textContent).toBe('Closed');
    expect(document.querySelector('.row-hours')!.classList.contains('open')).toBe(false);
  });

  it('parses a raw opening-hours string when no structured hours exist', async () => {
    await renderAt({ openingHours: 'Mo-Su 06:00-22:00' });
    expect(document.querySelector('.row-hours')!.textContent).toBe('06:00–22:00');
  });

  it('shows nothing when hours are unknown or the lookup fails', async () => {
    await renderAt({});
    expect(document.querySelector('.row-hours')).toBeNull();
    cleanup();
    resolveMeta.mockRejectedValue(new Error('x'));
    render(<GymPicker {...base} gyms={[NEAR]} variant="inline" />);
    await flush();
    expect(document.querySelector('.row-hours')).toBeNull();
  });
});
