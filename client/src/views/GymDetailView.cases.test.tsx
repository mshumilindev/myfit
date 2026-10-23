import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setLocale } from '../i18n';
import { resetGeoGateForTests, setGeoSearchState } from '../data/geoSearchGate';
import { en } from '../i18n/en';
import { fmtTonnes } from '../i18n';
import { __getStateForTests, workoutVolumeKg } from '../store';
import {
  emptyState,
  freezeClock,
  GYM,
  makeShell,
  NOW,
  richState,
  seed,
} from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({
  address: vi.fn(),
  meta: vi.fn(),
}));
vi.mock('../data/gymProviders', async (orig) => ({
  ...(await orig<typeof import('../data/gymProviders')>()),
  resolveAddress: m.address,
  resolveGymMeta: m.meta,
  resolvePhoto: () => Promise.resolve(null),
}));
vi.mock('../components/RouteMap', () => ({
  RouteMap: ({ from, to }: { from: unknown; to: unknown }) => (
    <div data-testid="route-map" data-from={JSON.stringify(from)} data-to={JSON.stringify(to)} />
  ),
}));

import { GymDetailView } from './GymDetailView';

const geo = (impl: 'ok' | 'denied' | 'none') => {
  if (impl === 'none') {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
    delete (navigator as unknown as Record<string, unknown>).geolocation;
    return;
  }
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: PositionCallback, bad: PositionErrorCallback) =>
        impl === 'ok'
          ? ok({
              coords: { latitude: GYM.lat, longitude: GYM.lng, accuracy: 10 },
            } as GeolocationPosition)
          : bad({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
    },
  });
};

/** Today's weekday index (Mon = 0) at the frozen clock, as the view computes it. */
const todayIdx = (new Date(NOW).getDay() + 6) % 7;
const week = (today: Array<[number, number]>, other: Array<[number, number]> = [[480, 1200]]) =>
  Array.from({ length: 7 }, (_, i) => (i === todayIdx ? today : other));

const gymWithSessions = () => {
  const s = richState();
  const done = s.workouts.filter((w) => w.finishedAt !== null);
  s.workouts = s.workouts.map((w) => {
    const i = done.indexOf(w);
    const { gymId: _drop, ...rest } = w;
    void _drop;
    return i >= 0 && i < 3
      ? { ...rest, gymId: 'g1' }
      : i >= 3 && i < 5
        ? { ...rest, gymId: 'g2' }
        : rest;
  });
  return s;
};

const open = (props: Partial<React.ComponentProps<typeof GymDetailView>> = {}) => {
  const shell = makeShell();
  const onClose = vi.fn();
  const out = render(<GymDetailView gymId="g1" shell={shell} onClose={onClose} {...props} />);
  return { ...out, shell, onClose };
};

beforeEach(() => {
  // Position and map lookups are gated on the geo-search consent (SPO-293): these cases run with it granted.
  resetGeoGateForTests();
  setGeoSearchState({ on: true, ready: true, answered: true });
  freezeClock();
  setLocale('en');
  localStorage.clear();
  m.address.mockReset().mockResolvedValue(null);
  m.meta.mockReset().mockResolvedValue(null);
  geo('denied');
  seed(gymWithSessions());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GymDetailView: identity and fallbacks', () => {
  it('without a gym or coordinates it renders only the back button', () => {
    const { onClose, container } = open({ gymId: 'nope' });
    expect(container.querySelector('h2')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(onClose).toHaveBeenCalled();
  });

  it('a saved gym shows its name, coordinates until an address resolves, and the resolved address', async () => {
    m.address.mockResolvedValue('1 Iron St, Town');
    const { container } = open();
    expect(container.querySelector('h2')?.textContent).toBe('Iron Yard');
    expect(container.querySelector('.loc')?.textContent).toContain('1.00000, 1.00000');
    await waitFor(() =>
      expect(container.querySelector('.loc')?.textContent).toContain('1 Iron St, Town'),
    );
    expect(m.address).toHaveBeenCalledWith(1, 1, expect.anything());
  });

  it('a candidate address is used as is and not looked up', () => {
    const { container } = open({
      gymId: undefined,
      candName: 'New Place',
      candLat: 9,
      candLng: 9,
      candAddress: '9 Cand Rd',
    });
    expect(container.querySelector('.loc')?.textContent).toContain('9 Cand Rd');
    expect(m.address).not.toHaveBeenCalled();
  });

  it('failed address and meta lookups leave the page usable', async () => {
    m.address.mockRejectedValue(new Error('x'));
    m.meta.mockRejectedValue(new Error('y'));
    const { container } = open();
    await act(async () => undefined);
    expect(container.querySelector('h2')?.textContent).toBe('Iron Yard');
    expect(screen.getByText(en.gymHoursUnknown)).toBeTruthy();
  });
});

describe('GymDetailView: saved vs candidate', () => {
  it('an unsaved candidate offers "Add this gym" and no stats, delete or main toggle', () => {
    open({ gymId: undefined, candName: 'New Place', candLat: 9, candLng: 9 });
    expect(screen.getByRole('button', { name: en.gymAdd })).toBeTruthy();
    expect(screen.queryByText(en.gymNoStats)).toBeNull();
    expect(screen.queryByRole('button', { name: en.delete })).toBeNull();
    expect(screen.queryByLabelText(en.gymMainLabel)).toBeNull();
  });

  it('adding saves it with the default radius, the external id and auto amenities', () => {
    open({
      gymId: undefined,
      candName: 'New Place',
      candLat: 9,
      candLng: 9,
      candExternalId: 'osm:77',
      candAmenities: ['wifi'],
    });
    fireEvent.click(screen.getByRole('button', { name: en.gymAdd }));
    const g = __getStateForTests().gyms.find((x) => x.name === 'New Place')!;
    expect(g.externalId).toBe('osm:77');
    expect(g.amenitiesAuto).toEqual(['wifi']);
    expect(g.radiusM).toBeGreaterThan(0);
    // once saved, its coordinates match the new gym, so the page flips to the saved layout
    expect(screen.queryByRole('button', { name: en.gymAdd })).toBeNull();
    expect(screen.getByRole('button', { name: en.delete })).toBeTruthy();
  });

  it('a candidate whose coordinates match a saved gym is shown as that saved gym', () => {
    const { container } = open({
      gymId: undefined,
      candName: 'Alias',
      candLat: 1.00005,
      candLng: 1.00005,
    });
    expect(container.querySelector('h2')?.textContent).toBe('Iron Yard');
    expect(screen.queryByRole('button', { name: en.gymAdd })).toBeNull();
    expect(screen.getByRole('button', { name: en.delete })).toBeTruthy();
  });

  it('start session here on a candidate saves it first, then opens the session', () => {
    const { shell } = open({ gymId: undefined, candName: 'New Place', candLat: 9, candLng: 9 });
    fireEvent.click(screen.getByRole('button', { name: en.startSessionHere }));
    const st = __getStateForTests();
    const g = st.gyms.find((x) => x.name === 'New Place')!;
    const live = st.workouts.find((w) => w.finishedAt === null)!;
    expect(live.gymId).toBe(g.id);
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'session', workoutId: live.id });
  });

  it('start session does not open anything when an activity is already running', () => {
    const s = richState();
    s.activities = [{ ...s.activities[0], finishedAt: null }];
    seed(s);
    const { shell } = open();
    fireEvent.click(screen.getByRole('button', { name: en.startSessionHere }));
    expect(shell.openOverlay).not.toHaveBeenCalled();
  });
});

describe('GymDetailView: stats, main gym, delete', () => {
  it('shows the sessions logged here, the tonnage and the average length', () => {
    const { container } = open();
    const st = __getStateForTests();
    const mine = st.workouts.filter((w) => w.gymId === 'g1' && w.finishedAt !== null);
    expect(mine).toHaveLength(3);
    const cells = [...container.querySelectorAll('.stat-grid .cell .v')].map((c) => c.textContent);
    expect(cells[0]).toBe('3');
    expect(cells[1]).toBe(fmtTonnes(mine.reduce((a, w) => a + workoutVolumeKg(w), 0)));
    expect(container.querySelectorAll('.stat-grid .cell .l')[2].textContent).toBe(en.gymStatAvg);
  });

  it('a gym with no finished sessions says so', () => {
    seed({ ...richState(), workouts: [] });
    open();
    expect(screen.getByText(en.gymNoStats)).toBeTruthy();
    expect(screen.getByText(en.gymMainSub)).toBeTruthy();
  });

  it('describes where the last 180 days were trained once there is history', () => {
    open();
    const total = __getStateForTests().workouts.filter((w) => w.finishedAt !== null).length;
    expect(screen.getByText(en.gymMainStat(3, 5, total - 5))).toBeTruthy();
  });

  it('the main-gym checkbox toggles the explicit favourite flag', () => {
    open();
    const box = screen.getByLabelText(en.gymMainLabel) as HTMLInputElement;
    const before = box.checked;
    fireEvent.click(box);
    expect((screen.getByLabelText(en.gymMainLabel) as HTMLInputElement).checked).toBe(!before);
  });

  it('delete asks first; keep cancels, delete removes the gym and closes the page', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: en.delete }));
    expect(screen.getByText(en.deleteGymTitle('Iron Yard'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.keep }));
    expect(__getStateForTests().gyms.some((g) => g.id === 'g1')).toBe(true);
    expect(screen.queryByText(en.deleteGymTitle('Iron Yard'))).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.delete }));
    const dialog = screen
      .getByText(en.deleteGymTitle('Iron Yard'))
      .closest('[role="dialog"], [role="alertdialog"]')!;
    fireEvent.click(
      Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === en.delete)!,
    );
    expect(__getStateForTests().gyms.some((g) => g.id === 'g1')).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });

  it('deleting the main gym uses the stronger warning', () => {
    seed({ ...gymWithSessions(), gyms: [{ ...GYM, favorite: true }] });
    open();
    fireEvent.click(screen.getByRole('button', { name: en.delete }));
    expect(screen.getByText(en.deleteMainGymBody(3))).toBeTruthy();
  });
});

describe('GymDetailView: hours', () => {
  it('unknown hours', () => {
    open();
    expect(screen.getByText(en.gymHoursUnknown)).toBeTruthy();
    expect(screen.queryByText(en.gymOpenNow)).toBeNull();
  });

  it('24/7 hours read "Open 24/7" and open now', async () => {
    m.meta.mockResolvedValue({ hours: { week: Array.from({ length: 7 }, () => [[0, 1440]]) } });
    open();
    expect(await screen.findByText(en.gymOpen247)).toBeTruthy();
    expect(screen.getByText(en.gymOpenNow)).toBeTruthy();
  });

  it("inside today's range it is open now; the week list expands and marks today", async () => {
    m.meta.mockResolvedValue({ hours: { week: week([[600, 780]]) } }); // clock is 12:00
    const { container } = open();
    expect(await screen.findByText(en.gymOpenNow)).toBeTruthy();
    expect(container.querySelector('.hours-today')?.textContent).toContain('10:00–13:00');
    expect(container.querySelector('.hours-week')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.gymAllWeek }));
    const rows = container.querySelectorAll('.hours-week .row');
    expect(rows).toHaveLength(7);
    expect(rows[todayIdx].classList.contains('today')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: en.gymAllWeek }));
    expect(container.querySelector('.hours-week')).toBeNull();
  });

  it('outside the range it is closed now, and a day with no ranges reads Closed', async () => {
    m.meta.mockResolvedValue({ hours: { week: week([]) } });
    const { container } = open();
    expect(await screen.findByText(en.gymClosedNow)).toBeTruthy();
    expect(container.querySelector('.hours-today')?.textContent).toContain(en.gymDayClosed);
  });

  it('a range that wraps past midnight counts as open at 12:00 when it covers it', async () => {
    m.meta.mockResolvedValue({ hours: { week: week([[1200, 780]]) } }); // 20:00 -> 13:00
    open();
    expect(await screen.findByText(en.gymOpenNow)).toBeTruthy();
  });

  it('raw opening_hours text is parsed', async () => {
    m.meta.mockResolvedValue({ openingHours: 'Mo-Su 00:00-24:00' });
    open();
    expect(await screen.findByText(en.gymOpen247)).toBeTruthy();
  });

  it('without parsed hours the provider openNow flag is not shown either', async () => {
    m.meta.mockResolvedValue({ openNow: true });
    open();
    expect(await screen.findByText(en.gymHoursUnknown)).toBeTruthy();
    expect(screen.getByText(en.gymOpenNow)).toBeTruthy(); // falls back to the provider flag
  });
});

describe('GymDetailView: location, route and contact', () => {
  it('without a fix the directions link points at the map pin', () => {
    open();
    const a = screen.getByRole('link', { name: new RegExp(en.gymDirections) }) as HTMLAnchorElement;
    expect(a.href).toContain('openstreetmap.org/?mlat=1&mlon=1');
    expect(screen.getByTestId('route-map').getAttribute('data-from')).toBe('null');
  });

  it('with a fix it shows the distance, the inside tag and a route link from me', async () => {
    geo('ok');
    const { container } = open();
    expect(await screen.findByText(en.inside)).toBeTruthy();
    expect(container.querySelector('.loc')?.textContent).toContain('0 m');
    const a = screen.getByRole('link', { name: new RegExp(en.gymDirections) }) as HTMLAnchorElement;
    expect(a.href).toContain('directions?engine=fossgis_osrm_foot&route=1%2C1%3B1%2C1');
    expect(JSON.parse(screen.getByTestId('route-map').getAttribute('data-from')!)).toEqual({
      lat: 1,
      lng: 1,
    });
  });

  it('a far-away fix shows a distance but not the inside tag', async () => {
    geo('ok');
    seed({ ...gymWithSessions(), gyms: [{ ...GYM, lat: 1.5, lng: 1.5 }] });
    const { container } = open();
    await waitFor(() => expect(container.querySelector('.loc')?.textContent).toMatch(/km/));
    expect(screen.queryByText(en.inside)).toBeNull();
  });

  it('shows website and call links when the venue has them', async () => {
    m.meta.mockResolvedValue({ website: 'https://iron.example', phone: '+3700000' });
    open();
    const web = (await screen.findByRole('link', {
      name: new RegExp(en.gymWebsite),
    })) as HTMLAnchorElement;
    expect(web.href).toBe('https://iron.example/');
    const call = screen.getByRole('link', { name: new RegExp(en.gymCall) }) as HTMLAnchorElement;
    expect(call.getAttribute('href')).toBe('tel:+3700000');
  });

  it('only one of website/phone shows when the other is missing', async () => {
    m.meta.mockResolvedValue({ phone: '123' });
    open();
    await screen.findByRole('link', { name: new RegExp(en.gymCall) });
    expect(screen.queryByRole('link', { name: new RegExp(en.gymWebsite) })).toBeNull();
  });
});

describe('GymDetailView: other states', () => {
  it('an empty store with a candidate still renders (no workouts, no gyms)', () => {
    seed(emptyState());
    const { container } = open({ gymId: undefined, candName: 'Solo', candLat: 3, candLng: 3 });
    expect(container.querySelector('h2')?.textContent).toBe('Solo');
  });

  it('localises weekday names', async () => {
    setLocale('uk');
    m.meta.mockResolvedValue({ hours: { week: week([[600, 780]]) } });
    const { container } = open();
    await waitFor(() => expect(container.querySelectorAll('.hours-today span')).toHaveLength(2));
    const expected = new Intl.DateTimeFormat('uk-UA', { weekday: 'short' }).format(
      new Date(2024, 0, 1 + todayIdx),
    );
    expect(container.querySelector('.hours-today span')?.textContent).toBe(expected);
  });
});
