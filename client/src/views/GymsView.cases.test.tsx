import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { fmtTonnes } from '../i18n';
import { __getStateForTests, workoutVolumeKg } from '../store';
import { DEFAULT_GYM_RADIUS_M } from '../types';
import { emptyState, freezeClock, NOW, richState, seed, setDesktop } from './__fixtures__/viewKit';
import { openGyms, setGeo } from './__fixtures__/gymsKit';
import { resetGeoGateForTests, setGeoSearchState } from '../data/geoSearchGate';

const m = vi.hoisted(() => ({ address: vi.fn(), search: vi.fn() }));
vi.mock('../data/gymProviders', async (orig) => ({
  ...(await orig<typeof import('../data/gymProviders')>()),
  resolveAddress: m.address,
  resolvePhoto: () => Promise.resolve(null),
  searchGyms: m.search,
  readCache: () => null,
}));
vi.mock('../components/RouteMap', () => ({
  RouteMap: ({ to }: { to: unknown }) => (
    <div data-testid="route-map" data-to={JSON.stringify(to)} />
  ),
}));

const withSessions = () => {
  const s = richState();
  const done = s.workouts.filter((w) => w.finishedAt !== null);
  s.workouts = s.workouts.map((w) => {
    const { gymId: _g, ...rest } = w;
    void _g;
    const i = done.indexOf(w);
    return i >= 0 && i < 7 ? { ...rest, gymId: 'g1' } : rest;
  });
  return s;
};

beforeEach(() => {
  // Gym search and maps are gated on the geo-search consent (SPO-293): these cases run with it granted.
  resetGeoGateForTests();
  setGeoSearchState({ on: true, ready: true, answered: true });
  freezeClock();
  setLocale('en');
  localStorage.clear();
  setDesktop(false);
  setGeo('denied');
  m.address.mockReset().mockResolvedValue(null);
  m.search.mockReset().mockResolvedValue(undefined);
  seed(withSessions());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GymsView: list', () => {
  it('with no gyms: intro, empty state and footnote', () => {
    seed(emptyState());
    openGyms();
    expect(screen.getByText(en.gymsIntro)).toBeTruthy();
    expect(screen.getByText(en.noGymsYet)).toBeTruthy();
    expect(screen.queryByText(en.myGyms)).toBeNull();
  });

  it('lists saved gyms with a main tag, coordinates until an address resolves', async () => {
    m.address.mockImplementation(async (lat: number) => (lat === 1 ? '1 Iron St' : null));
    const { container } = openGyms();
    expect(screen.getByText(en.myGyms)).toBeTruthy();
    const names = [...container.querySelectorAll('.gym-card .n')].map((n) => n.textContent);
    expect(names).toEqual(['Iron Yard', 'Home Rack']);
    expect(container.querySelectorAll('.gym-card')[1].querySelector('.meta')?.textContent).toBe(
      '5.00000, 5.00000',
    );
    await waitFor(() =>
      expect(container.querySelectorAll('.gym-card')[0].querySelector('.meta')?.textContent).toBe(
        '1 Iron St',
      ),
    );
    expect(container.querySelectorAll('.gym-card')[0].textContent).toContain(en.pickGymFavourite);
    expect(container.querySelectorAll('.gym-card')[1].textContent).not.toContain(
      en.pickGymFavourite,
    );
    expect(screen.queryByText(en.noGymsYet)).toBeNull();
  });

  it('prefixes the distance once the position is known', async () => {
    setGeo({ lat: 1, lng: 1, accuracy: 10 });
    const { container } = openGyms();
    await waitFor(() =>
      expect(
        container.querySelectorAll('.gym-card')[0].querySelector('.meta')?.textContent,
      ).toMatch(/^0 m · /),
    );
    expect(container.querySelectorAll('.gym-card')[1].querySelector('.meta')?.textContent).toMatch(
      /\d+\.\d km · /,
    );
  });

  it('a failed address lookup leaves the coordinates', async () => {
    m.address.mockRejectedValue(new Error('offline'));
    const { container } = openGyms();
    await act(async () => undefined);
    expect(container.querySelector('.gym-card .meta')?.textContent).toBe('1.00000, 1.00000');
  });

  it('opening a card (click, Enter or Space) opens the gym with its address', async () => {
    m.address.mockResolvedValue('Somewhere 1');
    const { container, shell } = openGyms();
    await waitFor(() =>
      expect(container.querySelector('.gym-card .meta')?.textContent).toBe('Somewhere 1'),
    );
    const card = container.querySelectorAll('.gym-card')[0] as HTMLElement;
    fireEvent.click(card);
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'gym',
      gymId: 'g1',
      name: 'Iron Yard',
      lat: 1,
      lng: 1,
      address: 'Somewhere 1',
    });
    const second = container.querySelectorAll('.gym-card')[1] as HTMLElement;
    fireEvent.keyDown(second, { key: 'Enter' });
    expect(shell.openOverlay).toHaveBeenLastCalledWith(expect.objectContaining({ gymId: 'g2' }));
    fireEvent.keyDown(card, { key: ' ' });
    expect(shell.openOverlay).toHaveBeenLastCalledWith(expect.objectContaining({ gymId: 'g1' }));
    const n = (shell.openOverlay as ReturnType<typeof vi.fn>).mock.calls.length;
    fireEvent.keyDown(card, { key: 'a' });
    expect(shell.openOverlay).toHaveBeenCalledTimes(n);
  });

  it('hover and focus select the card', () => {
    const { container } = openGyms();
    const cards = container.querySelectorAll('.gym-card');
    expect(cards[0].classList.contains('selected')).toBe(true);
    fireEvent.mouseEnter(cards[1]);
    expect(container.querySelectorAll('.gym-card')[1].classList.contains('selected')).toBe(true);
    expect(container.querySelectorAll('.gym-card')[0].classList.contains('selected')).toBe(false);
    fireEvent.focus(container.querySelectorAll('.gym-card')[0]);
    expect(container.querySelectorAll('.gym-card')[0].classList.contains('selected')).toBe(true);
  });
});

describe('GymsView: adding a gym where you stand', () => {
  const typeName = (name: string) => {
    fireEvent.change(screen.getByPlaceholderText(en.searchGymPlaceholder), {
      target: { value: name },
    });
  };
  const imHere = () => fireEvent.click(screen.getByText(en.imHere).closest('button')!);

  it('a good fix saves the gym with the default radius and toasts the accuracy', async () => {
    setGeo({ lat: 10, lng: 20, accuracy: 12.4 });
    const { shell } = openGyms();
    typeName('  Basement  ');
    imHere();
    await waitFor(() =>
      expect(__getStateForTests().gyms.some((g) => g.name === 'Basement')).toBe(true),
    );
    const g = __getStateForTests().gyms.find((x) => x.name === 'Basement')!;
    expect(g).toMatchObject({ lat: 10, lng: 20, radiusM: DEFAULT_GYM_RADIUS_M });
    expect(shell.toast).toHaveBeenCalledWith({
      kind: 'ok',
      icon: 'check-circle',
      text: en.gymAdded(12),
    });
    expect((screen.getByPlaceholderText(en.searchGymPlaceholder) as HTMLInputElement).value).toBe(
      '  Basement  ',
    );
  });

  it('a coarse fix (over 100 m) asks before saving; "Save anyway" uses a 250 m radius', async () => {
    setGeo({ lat: 10, lng: 20, accuracy: 180 });
    const { shell } = openGyms();
    typeName('Basement');
    imHere();
    expect(await screen.findByText(en.gpsCoarse(180))).toBeTruthy();
    expect(__getStateForTests().gyms.some((g) => g.name === 'Basement')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: en.saveAnyway }));
    const g = __getStateForTests().gyms.find((x) => x.name === 'Basement')!;
    expect(g.radiusM).toBe(250);
    expect(shell.toast).toHaveBeenCalledWith(expect.objectContaining({ text: en.gymAdded(180) }));
    expect(screen.queryByText(en.gpsCoarse(180))).toBeNull();
  });

  it('retry after a coarse fix reads the position again and can then save', async () => {
    setGeo({ lat: 10, lng: 20, accuracy: 180 });
    openGyms();
    typeName('Basement');
    imHere();
    await screen.findByText(en.gpsCoarse(180));
    setGeo({ lat: 10, lng: 20, accuracy: 20 });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.retry) }));
    await waitFor(() =>
      expect(__getStateForTests().gyms.some((g) => g.name === 'Basement')).toBe(true),
    );
    expect(screen.queryByText(en.gpsCoarse(180))).toBeNull();
  });

  it('a denied location shows the blocked card, hides search; try again re-attempts', async () => {
    openGyms();
    typeName('Basement');
    imHere();
    expect(await screen.findByText(en.locationBlocked)).toBeTruthy();
    expect(screen.getByText(en.locationBlockedFootnote)).toBeTruthy();
    expect(screen.queryByPlaceholderText(en.searchGymPlaceholder)).toBeNull();
    expect(screen.queryByText(en.noGymsYet)).toBeNull();
    setGeo({ lat: 3, lng: 4, accuracy: 5 });
    fireEvent.click(screen.getByRole('button', { name: en.tryAgain }));
    await waitFor(() =>
      expect(__getStateForTests().gyms.some((g) => g.name === 'Basement')).toBe(true),
    );
    expect(screen.queryByText(en.locationBlocked)).toBeNull();
  });

  it('shows the locating card while reading the position', async () => {
    let resolve!: (p: GeolocationPosition) => void;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback) => {
          resolve = ok as unknown as (p: GeolocationPosition) => void;
        },
      },
    });
    openGyms();
    typeName('Basement');
    imHere();
    expect(await screen.findByText(en.readingPosition)).toBeTruthy();
    expect(screen.getByText(en.locating)).toBeTruthy();
    expect((screen.getByText(en.locating).closest('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
    await act(async () =>
      resolve({ coords: { latitude: 1, longitude: 2, accuracy: 5 } } as GeolocationPosition),
    );
    expect(screen.queryByText(en.readingPosition)).toBeNull();
  });
});

describe('GymsView: desktop detail pane', () => {
  beforeEach(() => setDesktop(true));

  it('shows the selected gym with stats and the latest sessions, newest first', () => {
    const { container } = openGyms();
    const pane = container.querySelector('.gyms-detail-pane')!;
    expect(pane.querySelector('h1')?.textContent).toBe('Iron Yard');
    const mine = __getStateForTests()
      .workouts.filter((w) => w.gymId === 'g1' && w.finishedAt !== null)
      .sort((a, b) => b.startedAt - a.startedAt);
    expect(mine).toHaveLength(7);
    expect(pane.querySelector('.gyms-stat-grid .v')?.textContent).toBe('7');
    expect(pane.querySelectorAll('.gyms-session-row')).toHaveLength(5);
    const first = pane.querySelector('.gyms-session-row')!;
    expect(first.textContent).toContain(fmtTonnes(workoutVolumeKg(mine[0])));
    const totalVol = mine.reduce((a, w) => a + workoutVolumeKg(w), 0);
    expect(pane.querySelectorAll('.gyms-stat-grid .v')[1].textContent).toBe(fmtTonnes(totalVol));
    expect(JSON.parse(screen.getByTestId('route-map').getAttribute('data-to')!)).toEqual({
      lat: 1,
      lng: 1,
    });
  });

  it('hovering another gym switches the pane; a gym without sessions says so', () => {
    const { container } = openGyms();
    fireEvent.mouseEnter(container.querySelectorAll('.gym-card')[1]);
    const pane = container.querySelector('.gyms-detail-pane')!;
    expect(pane.querySelector('h1')?.textContent).toBe('Home Rack');
    expect(pane.querySelector('.gyms-stat-grid')).toBeNull();
    expect(screen.getAllByText(en.gymNoStats).length).toBe(2);
    expect(pane.textContent).toContain('5.00000, 5.00000');
  });

  it('opens a past session, and an exercise name drills into its history without opening the session', () => {
    const { container, shell } = openGyms();
    const row = container.querySelector('.gyms-session-row') as HTMLElement;
    fireEvent.click(row);
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'past-workout',
      workoutId: expect.any(String),
    });
    const calls = (shell.openOverlay as ReturnType<typeof vi.fn>).mock.calls.length;
    const drill = row.querySelector('.inline-drill') as HTMLElement;
    fireEvent.click(drill);
    expect(shell.openOverlay).toHaveBeenCalledTimes(calls + 1);
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'exercise-history',
      name: expect.any(String),
    });
    fireEvent.keyDown(drill, { key: 'Enter' });
    fireEvent.keyDown(drill, { key: ' ' });
    expect(shell.openOverlay).toHaveBeenCalledTimes(calls + 3);
    fireEvent.keyDown(drill, { key: 'x' });
    expect(shell.openOverlay).toHaveBeenCalledTimes(calls + 3);
  });

  it('"Edit" opens the gym page', () => {
    const { shell } = openGyms();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.edit) }));
    expect(shell.openOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ screen: 'gym', gymId: 'g1' }),
    );
  });

  it('start session starts a workout at that gym and opens it', () => {
    const { shell } = openGyms();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.startSessionHere) }));
    const live = __getStateForTests().workouts.find((w) => w.finishedAt === null)!;
    expect(live.gymId).toBe('g1');
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'session', workoutId: live.id });
  });

  it('with a session already running the button is disabled', () => {
    const s = withSessions();
    s.workouts = [
      {
        id: 'live',
        startedAt: NOW - 1000,
        finishedAt: null,
        autoFinished: false,
        gymId: 'g1',
        dayName: null,
        targetMuscles: [],
        exercises: [],
      },
      ...s.workouts,
    ] as never;
    seed(s);
    openGyms();
    expect(
      (screen.getByRole('button', { name: new RegExp(en.startSessionHere) }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('with an activity running the button is disabled too', () => {
    const s = withSessions();
    s.activities = [{ ...s.activities[0], finishedAt: null }];
    seed(s);
    openGyms();
    expect(
      (screen.getByRole('button', { name: new RegExp(en.startSessionHere) }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('is absent on narrow screens and with no gyms', () => {
    setDesktop(false);
    const a = openGyms();
    expect(a.container.querySelector('.gyms-detail-pane')).toBeNull();
    cleanup();
    setDesktop(true);
    seed({ ...emptyState(), gyms: [] });
    const b = openGyms();
    expect(b.container.querySelector('.gyms-detail-pane')).toBeNull();
  });
});
