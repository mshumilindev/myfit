import { describe, expect, it, vi } from 'vitest';
import { ACUTE_CAP_FULL, muscleFatigue } from './fatigue';
import type { Workout } from './types';

// The lowest deload multiplier nicotine (-10 %) and alcohol (-6 %) can reach together.
vi.mock('./calcMods', async (orig) => ({
  ...(await orig<typeof import('./calcMods')>()),
  deloadMult: () => 0.9 * 0.94,
  readinessMult: () => 1,
}));

const NOW = Date.UTC(2026, 10, 19, 19, 0);
const w = (n: number): Workout => ({
  id: 'w',
  startedAt: NOW - 3600000,
  finishedAt: NOW,
  autoFinished: false,
  exercises: [
    {
      id: 'e',
      name: 'Barbell Bench Press - Medium Grip',
      position: 0,
      sets: Array.from({ length: n }, (_, i) => ({
        id: `s${i}`,
        reps: 8,
        weight: 60,
        isWarmup: false,
        position: i,
        loggedAt: NOW,
      })),
    },
  ],
});

describe('SPO-601: the acute term stays below "fried" at the lowest deload multiplier', () => {
  it('full cap < 0.7 * deloadMult', () => {
    expect(ACUTE_CAP_FULL).toBeLessThan(0.7 * 0.9 * 0.94);
  });

  it('a fresh 3/11/15-set chest session is never fried, even with the multiplier at its floor', () => {
    for (const n of [3, 11, 15]) {
      const c = muscleFatigue([w(n)], NOW).get('chest')!;
      expect(c.level).not.toBe('fried');
      expect(c.weeklyLevel).not.toBe('fried');
    }
  });
});
