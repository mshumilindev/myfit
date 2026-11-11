import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './enabledSet';
import { plannerAvailable } from './featureGates';
import { addonById } from './manifest';
import { EXCLUSION } from './exclusion';

beforeEach(() => addonsPref.reset());

describe('Planner add-on gate (SPO-552 I1)', () => {
  it('is in the manifest and the exclusion contract', () => {
    expect(addonById('planner')).toBeTruthy();
    expect(EXCLUSION.planner?.via).toContain('gate');
  });
  it('is off until installed (nothing of it may show)', () => {
    expect(plannerAvailable()).toBe(false);
  });
  it('turns on when installed and off again when removed', () => {
    addonsPref.set(['planner']);
    expect(plannerAvailable()).toBe(true);
    addonsPref.reset();
    expect(plannerAvailable()).toBe(false);
  });
});
