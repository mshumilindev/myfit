import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../store', () => ({ recordE1rm: (n: string) => (n === 'Back Squat' ? 133.33 : 0) }));
vi.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));

import { maxFor, maxInfo } from './maxes';
import { EMPTY_MAXES, withMax } from './maxesData';
import { seedMaxes } from './maxesSync';

afterEach(() => seedMaxes(EMPTY_MAXES));

describe('the max a percent is turned into kilograms against', () => {
  it('is the estimate from history, rounded to 0.1, when nothing was typed', () => {
    expect(maxInfo('Back Squat')).toEqual({ kg: 133.3, source: 'history', estimate: 133.3 });
  });
  it('is none without history or a typed max', () => {
    expect(maxInfo('Weighted Pullups')).toEqual({ kg: null, source: 'none', estimate: null });
    expect(maxFor('Weighted Pullups')).toBeNull();
  });
  it('a typed max replaces the estimate, whatever the letter case, and the estimate stays known', () => {
    seedMaxes(withMax(EMPTY_MAXES, 'back squat', 150, 1));
    expect(maxInfo('Back Squat')).toEqual({ kg: 150, source: 'typed', estimate: 133.3 });
    expect(maxFor('Back Squat')).toBe(150);
  });
  it('a typed max works for an exercise with no history', () => {
    seedMaxes(withMax(EMPTY_MAXES, 'Weighted Pullups', 40, 1));
    expect(maxFor('Weighted Pullups')).toBe(40);
  });
});
