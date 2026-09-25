import { describe, expect, it } from 'vitest';
import { extrasFor, momAllowed, normalizeTemper, swearAllowed } from './types';

describe('temper extras', () => {
  it('"your mom" and swearing — red only', () => {
    expect([1, 3, 5].map((t) => momAllowed(t as 1))).toEqual([false, false, true]);
    expect([1, 3, 5].map((t) => swearAllowed(t as 1))).toEqual([false, false, true]);
  });
  it('red starts with both on; green and yellow switch them off', () => {
    expect(extrasFor(5)).toEqual({ yoMama: true, swearing: true });
    expect(extrasFor(3)).toEqual({ yoMama: false, swearing: false });
    expect(extrasFor(1)).toEqual({ yoMama: false, swearing: false });
  });
  it('old five-step tempers map onto the three', () => {
    expect([1, 2, 3, 4, 5, undefined, 'x'].map((v) => normalizeTemper(v))).toEqual([
      1, 1, 3, 5, 5, 3, 3,
    ]);
  });
});
