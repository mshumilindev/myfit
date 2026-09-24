import { describe, expect, it } from 'vitest';
import { extrasFor, momAllowed, swearAllowed } from './types';

describe('temper extras', () => {
  it('"your mom" from Drill up, swearing only Merciless', () => {
    expect([1, 2, 3, 4, 5].map((t) => momAllowed(t as 1))).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
    expect([1, 2, 3, 4, 5].map((t) => swearAllowed(t as 1))).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
  });
  it('Merciless starts with both on; softer tempers switch them off', () => {
    expect(extrasFor(5)).toEqual({ yoMama: true, swearing: true });
    expect(extrasFor(4)).toEqual({ yoMama: true, swearing: false });
    expect(extrasFor(3)).toEqual({ yoMama: false, swearing: false });
  });
});
