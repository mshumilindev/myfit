import { describe, expect, it } from 'vitest';
import { effectiveTemper } from './guard';
import { COACH_DEFAULT } from './types';

const ctx = {
  injuries: [],
  restPeriods: [
    { id: 'r', mode: 'illness', startDay: 0, endDay: 0, createdAt: 0, open: true },
  ] as never,
  sleeps: [],
  finished: [],
  now: Date.now(),
};

describe('effectiveTemper keepTemper', () => {
  it('softens on a rough day by default', () => {
    expect(effectiveTemper({ ...COACH_DEFAULT, temper: 5 }, ctx)).toBeLessThan(5);
  });
  it('keeps Savage when keepTemper is on', () => {
    expect(effectiveTemper({ ...COACH_DEFAULT, temper: 5, keepTemper: true }, ctx)).toBe(5);
  });
});
