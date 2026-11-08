import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './enabledSet';
import { sleepReadinessBias } from '../sleep';
import { softenReason } from '../atlas/guard';
import { computeMastery } from '../mastery';
import { __getStateForTests, __replaceStateForTests, getStoreState } from '../store';
import type { SleepNight } from '../types';

const NOW = Date.parse('2026-11-08T12:00:00Z');
const H = 3600_000;
/** A 4-hour night that ended two hours ago: it lowers readiness and softens Atlas, when it is read. */
const short: SleepNight = {
  id: 'n1',
  date: '2026-11-08',
  bedtime: NOW - 6 * H,
  wake: NOW - 2 * H,
  source: 'backfill',
} as SleepNight;

beforeEach(() => {
  __replaceStateForTests({ ...__getStateForTests(), sleeps: [short] });
});

const ctx = () => {
  const s = getStoreState();
  return { ...s, finished: [], now: NOW };
};

describe('models that read Sleep, with and without the add-on (SPO-500 I8, inventory rows 10-12, 22, 29-30, 34-35)', () => {
  it('without Sleep the readiness bias is exactly neutral and Atlas is not softened by a night', () => {
    addonsPref.reset();
    expect(sleepReadinessBias(getStoreState().sleeps, NOW)).toBe(0);
    expect(softenReason(ctx())).not.toBe('sleep');
  });
  it('with Sleep the same night moves the bias down and softens Atlas', () => {
    addonsPref.set(['sleep']);
    expect(sleepReadinessBias(getStoreState().sleeps, NOW)).toBeLessThan(0);
    expect(softenReason(ctx())).toBe('sleep');
  });
  it('Mastery rates the same with Sleep off as with no nights at all, and changes once Sleep is on', () => {
    const nights = [1, 2, 3, 4].map((i) => ({
      ...short,
      id: `n${i}`,
      bedtime: NOW - i * 24 * H - 6 * H,
      wake: NOW - i * 24 * H - 2 * H,
    })) as SleepNight[];
    __replaceStateForTests({ ...__getStateForTests(), sleeps: nights });
    const base = computeMastery({ ...getStoreState(), sleeps: [] }, NOW);
    addonsPref.reset();
    expect(computeMastery(getStoreState(), NOW)).toEqual(base);
    addonsPref.set(['sleep']);
    expect(computeMastery(getStoreState(), NOW)).not.toEqual(base);
  });
});
