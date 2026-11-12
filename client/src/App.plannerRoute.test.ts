import { describe, expect, it } from 'vitest';
import { fromHash, toHash } from './App';

describe('Planner route', () => {
  it('#/planner opens the Planner overlay on Today and back', () => {
    const r = fromHash('#/planner');
    expect(r).toEqual({ tab: 'today', overlay: { screen: 'planner' } });
    expect(
      toHash(
        'today',
        r.overlay,
        'mine' as never,
        false,
        'progress',
        'total' as never,
        'volume' as never,
      ),
    ).toBe('#/planner');
  });
});
