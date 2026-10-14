import { describe, expect, it } from 'vitest';
import { fitItems } from './useFitCount';

describe('fitItems', () => {
  it('shows everything when it fits, no overflow chip', () => {
    expect(fitItems(400, 70, 14, 4)).toEqual({ shown: 4, overflow: 0 });
  });
  it('puts the +N chip in the last slot of the same row', () => {
    // 400px holds 4 slots of 70 + 14 gap -> 3 clients + the chip
    expect(fitItems(400, 70, 14, 14)).toEqual({ shown: 3, overflow: 11 });
  });
  it('grows and shrinks with the width', () => {
    expect(fitItems(300, 70, 14, 14).shown).toBeLessThan(fitItems(600, 70, 14, 14).shown);
  });
  it('keeps at least one client and treats an unmeasured row as "show all"', () => {
    expect(fitItems(60, 70, 14, 9)).toEqual({ shown: 1, overflow: 8 });
    expect(fitItems(0, 70, 14, 9)).toEqual({ shown: 9, overflow: 0 });
  });
});
