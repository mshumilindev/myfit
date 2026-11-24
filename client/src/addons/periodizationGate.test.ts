import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './enabledSet';
import { advancedTrainingAvailable, periodizationAvailable } from './featureGates';
import { addonById, appOfItem } from './manifest';
import { EXCLUSION } from './exclusion';

beforeEach(() => addonsPref.reset());

describe('Advanced training › Periodization gate (SPO-609)', () => {
  it('is in the manifest as an add-on with a module, and in the exclusion contract', () => {
    expect(addonById('advanced-training')?.kind).toBe('addon');
    expect(addonById('periodization')?.parent).toBe('advanced-training');
    expect(appOfItem(addonById('periodization')!)).toBe('advanced-training');
    expect(appOfItem(addonById('advanced-training')!)).toBe('gym');
    expect(EXCLUSION['advanced-training']?.via).toContain('gate');
    expect(EXCLUSION.periodization?.via).toContain('gate');
  });
  it('is off until installed (nothing of it may show or count)', () => {
    expect(advancedTrainingAvailable()).toBe(false);
    expect(periodizationAvailable()).toBe(false);
  });
  it('turns on when installed and off again when removed', () => {
    addonsPref.set(['periodization']);
    expect(periodizationAvailable()).toBe(true);
    addonsPref.reset();
    expect(periodizationAvailable()).toBe(false);
  });
});
