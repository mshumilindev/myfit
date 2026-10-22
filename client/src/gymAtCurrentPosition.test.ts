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
});
