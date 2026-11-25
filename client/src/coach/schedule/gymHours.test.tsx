import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Gym } from './types';

const m = vi.hoisted(() => ({
  resolveGymMeta: vi.fn(),
  parseOpeningHours: vi.fn(() => null),
}));
vi.mock('../../data/gymProviders', () => m);
// The tests reset the module registry on purpose; the real Firebase init must not run twice in one world.
vi.mock('../../firebase', () => ({
  app: {},
  auth: { currentUser: null },
  db: {},
  functions: {},
  storage: {},
  analytics: null,
}));

const WEEK = Array.from({ length: 7 }, () => [[360, 1380]]) as Array<Array<[number, number]>>;
const gym = (id: string, extra: Partial<Gym> = {}): Gym =>
  ({ id, name: `Gym ${id}`, place: { lat: 52.18, lng: 21.02 }, ...extra }) as Gym;

beforeEach(() => {
  vi.resetModules();
  m.resolveGymMeta.mockReset();
  m.parseOpeningHours.mockReset().mockReturnValue(null);
});

describe('useGymWeeks (SPO-590)', () => {
  it('passes the gym name to the lookup and shows the hours it finds (Google fallback)', async () => {
    m.resolveGymMeta.mockResolvedValue({ hours: { week: WEEK } });
    const { useGymWeeks } = await import('./gymHours');
    const g = gym('a1');
    const { result } = renderHook(() => useGymWeeks([g]));
    await waitFor(() => expect(result.current.get('a1')).toEqual(WEEK));
    expect(m.resolveGymMeta).toHaveBeenCalledWith(52.18, 21.02, expect.any(AbortSignal), 'Gym a1');
  });

  it('a gym with no hours anywhere stays null: nothing is shaded', async () => {
    m.resolveGymMeta.mockResolvedValue({ phone: '+48 1' });
    const { useGymWeeks } = await import('./gymHours');
    const g = gym('b1');
    const { result } = renderHook(() => useGymWeeks([g]));
    await waitFor(() => expect(m.resolveGymMeta).toHaveBeenCalled());
    expect(result.current.get('b1')).toBeNull();
  });

  it('a lookup that found nothing (not signed in yet) is asked again later, not remembered', async () => {
    m.resolveGymMeta.mockResolvedValueOnce(null).mockResolvedValue({ hours: { week: WEEK } });
    const { useGymWeeks } = await import('./gymHours');
    const g = gym('c1');
    const first = renderHook(() => useGymWeeks([g]));
    await waitFor(() => expect(m.resolveGymMeta).toHaveBeenCalledTimes(1));
    first.unmount();
    const second = renderHook(() => useGymWeeks([g]));
    await waitFor(() => expect(second.result.current.get('c1')).toEqual(WEEK));
    expect(m.resolveGymMeta).toHaveBeenCalledTimes(2);
  });

  it('withdrawing the gym-search consent empties the hours found through it', async () => {
    m.resolveGymMeta.mockResolvedValue({ hours: { week: WEEK } });
    const gate = await import('../../data/geoSearchGate');
    gate.setGeoSearchState({ on: true, ready: true, answered: true });
    const { useGymWeeks } = await import('./gymHours');
    const g = gym('e1');
    const { result, rerender } = renderHook(() => useGymWeeks([g]));
    await waitFor(() => expect(result.current.get('e1')).toEqual(WEEK));
    act(() => gate.setGeoSearchState({ on: false, ready: true, answered: true }));
    rerender();
    expect(result.current.get('e1')).toBeNull();
  });

  it('fixture hours win and the lookup is not made', async () => {
    const { useGymWeeks } = await import('./gymHours');
    const g = gym('d1', { hours: WEEK as never });
    const { result } = renderHook(() => useGymWeeks([g]));
    expect(result.current.get('d1')).toEqual(WEEK);
    expect(m.resolveGymMeta).not.toHaveBeenCalled();
  });
});
