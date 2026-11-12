import { describe, expect, it, vi } from 'vitest';

vi.mock('./enabledSet', () => ({
  addonAvailable: () => {
    throw new Error('storage is gone');
  },
  useAddonOrBase: () => false,
}));

import { plannerAvailabilityAvailable, plannerAvailable } from './featureGates';

describe('Planner gates never throw', () => {
  it('a storage error reads as off', () => {
    expect(plannerAvailable()).toBe(false);
    expect(plannerAvailabilityAvailable()).toBe(false);
  });
});
