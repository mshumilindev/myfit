import { describe, expect, it } from 'vitest';
import { autoMainGymIds, isMainGym } from './mainGym';
import type { Gym, Workout } from './types';

const NOW = Date.UTC(2026, 9, 7);
const w = (gymId: string | null, daysAgo: number): Workout =>
  ({
    id: `${gymId}${daysAgo}`,
    gymId,
    startedAt: NOW - daysAgo * 86400000,
    finishedAt: NOW,
    exercises: [],
  }) as unknown as Workout;
const gym = (id: string, favorite?: boolean): Gym => ({
  id,
  name: id,
  lat: 0,
  lng: 0,
  radiusM: 1,
  favorite,
});

describe('auto main gym', () => {
  const log = [...Array.from({ length: 8 }, (_, i) => w('A', i * 3 + 1)), w('B', 2), w('B', 9)];
  it('picks gyms with enough recent sessions and a real share', () => {
    expect([...autoMainGymIds(log, NOW)]).toEqual(['A']);
  });
  it('needs enough data', () => {
    expect(autoMainGymIds(log.slice(0, 2), NOW).size).toBe(0);
  });
  it('ignores old sessions', () => {
    expect(
      autoMainGymIds(
        Array.from({ length: 10 }, (_, i) => w('A', 200 + i)),
        NOW,
      ).size,
    ).toBe(0);
  });
  it('an explicit choice wins over the log', () => {
    const auto = autoMainGymIds(log, NOW);
    expect(isMainGym(gym('A'), auto)).toBe(true);
    expect(isMainGym(gym('A', false), auto)).toBe(false);
    expect(isMainGym(gym('B', true), auto)).toBe(true);
  });
  it('sessions without a gym do not count against it', () => {
    const l = [
      ...Array.from({ length: 3 }, (_, i) => w('A', i + 1)),
      ...Array.from({ length: 20 }, (_, i) => w(null, i + 1)),
    ];
    expect([...autoMainGymIds(l, NOW)]).toEqual(['A']);
  });
  it('several gyms can qualify', () => {
    const two = [
      ...Array.from({ length: 7 }, (_, i) => w('A', i + 1)),
      ...Array.from({ length: 6 }, (_, i) => w('C', i + 10)),
    ];
    expect(autoMainGymIds(two, NOW).size).toBe(2);
  });
});
