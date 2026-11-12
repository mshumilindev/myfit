import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
}));

import { getPlans, getPrefs, seedPlannerPreview } from './sync';
import { DEFAULT_PREFS } from './data';
import type { PlanDoc } from './types';

describe('seedPlannerPreview (design-lab harness)', () => {
  it('fills the plans, and the prefs only when given', () => {
    const plan = { id: 'p' } as PlanDoc;
    seedPlannerPreview([plan]);
    expect(getPlans()).toEqual([plan]);
    expect(getPrefs()).toBe(DEFAULT_PREFS);
    const prefs = {
      ...DEFAULT_PREFS,
      shareAvailability: true,
      availability: { 0: [[390, 480]] as [number, number][] },
    };
    seedPlannerPreview([], prefs);
    expect(getPlans()).toEqual([]);
    expect(getPrefs()).toBe(prefs);
  });
});
