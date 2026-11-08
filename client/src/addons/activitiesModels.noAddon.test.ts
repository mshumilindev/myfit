import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './enabledSet';
import { autoLifestyle } from '../dayEnergy';
import { __getStateForTests, __replaceStateForTests, getStoreState } from '../store';
import type { Activity } from '../types';

const NOW = Date.parse('2026-11-08T12:00:00Z');
const DAY = 24 * 3600_000;
const many = Array.from({ length: 40 }, (_, i) => ({
  id: `a${i}`,
  type: 'running',
  category: 'conditioning',
  startedAt: NOW - (i % 14) * DAY - 5 * 3600_000,
  finishedAt: NOW - (i % 14) * DAY - 4 * 3600_000,
  durationMin: 60,
  calories: 500,
})) as unknown as Activity[];

beforeEach(() => {
  __replaceStateForTests({ ...__getStateForTests(), activities: many });
});

describe('the energy model reads Activities only when the add-on is on (SPO-500 I8, inventory rows 37-40)', () => {
  it('without it the lifestyle estimate is exactly what it is with no activities at all', () => {
    addonsPref.reset();
    const s = getStoreState();
    expect(autoLifestyle(s.workouts, s.activities, NOW)).toEqual(
      autoLifestyle(s.workouts, [], NOW),
    );
  });
  it('with it the same activities move the estimate', () => {
    addonsPref.set(['activities']);
    const s = getStoreState();
    expect(autoLifestyle(s.workouts, s.activities, NOW)).not.toEqual(
      autoLifestyle(s.workouts, [], NOW),
    );
  });
});
