import { afterEach, describe, expect, it, vi } from 'vitest';
import { gymAtCurrentPosition } from './store';
import type { Gym } from './types';

const gym = { id: 'g1', name: 'Gym', lat: 52.2, lng: 21.0, radiusM: 150 } as unknown as Gym;

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('gymAtCurrentPosition', () => {
  it('returns null at once when there is no saved gym', async () => {
    expect(await gymAtCurrentPosition([])).toBeNull();
  });

  it('never waits for a new fix: with no cached position it resolves null immediately', async () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    expect(await gymAtCurrentPosition([gym])).toBeNull();
  });

  it('uses a fresh cached fix inside the gym radius', async () => {
    localStorage.setItem(
      'spotter.lastPos',
      JSON.stringify({ lat: 52.2, lng: 21.0, accuracy: 20, at: Date.now() - 30_000 }),
    );
    expect((await gymAtCurrentPosition([gym]))?.id).toBe('g1');
  });

  it('ignores a stale cached fix (older than 2 min) and a poor-accuracy one', async () => {
    localStorage.setItem(
      'spotter.lastPos',
      JSON.stringify({ lat: 52.2, lng: 21.0, accuracy: 20, at: Date.now() - 5 * 60_000 }),
    );
    expect(await gymAtCurrentPosition([gym])).toBeNull();
    localStorage.setItem(
      'spotter.lastPos',
      JSON.stringify({ lat: 52.2, lng: 21.0, accuracy: 500, at: Date.now() }),
    );
    expect(await gymAtCurrentPosition([gym])).toBeNull();
  });
  it('refreshes the cache in the background when permission is granted, so the next start skips the question', async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: 52.2, longitude: 21.0, accuracy: 15 } } as GeolocationPosition),
    );
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition },
      permissions: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
    });
    // first start: nothing cached → picker opens at once, refresh runs behind it
    expect(await gymAtCurrentPosition([gym])).toBeNull();
    await vi.waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(localStorage.getItem('spotter.lastPos')).not.toBeNull());
    // next start: fresh cache inside the radius → no question
    expect((await gymAtCurrentPosition([gym]))?.id).toBe('g1');
  });

  it('does not touch geolocation in the background when permission is not granted', async () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition },
      permissions: { query: vi.fn().mockResolvedValue({ state: 'prompt' }) },
    });
    expect(await gymAtCurrentPosition([gym])).toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
