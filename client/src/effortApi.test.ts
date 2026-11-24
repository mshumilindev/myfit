import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './addons/enabledSet';
import { effortHost, effortLive } from './effortApi';
import { Chips } from './effort/pieces';
import { addonById } from './addons/manifest';
import { EXCLUSION } from './addons/exclusion';

beforeEach(() => addonsPref.reset());
afterEach(() => {
  effortHost.Chips = null;
  addonsPref.reset();
});

describe('RPE / RIR seam', () => {
  it('is a module of Advanced training with an exclusion entry', () => {
    expect(addonById('effort')?.parent).toBe('advanced-training');
    expect(EXCLUSION.effort?.via).toContain('gate');
  });
  it('is off until installed, and stays off until its chunk has loaded', () => {
    expect(effortLive()).toBe(false);
    addonsPref.set(['effort']);
    expect(effortLive()).toBe(false);
  });
  it('is live once installed and loaded, off again when removed', () => {
    addonsPref.set(['effort']);
    effortHost.Chips = Chips;
    expect(effortLive()).toBe(true);
    addonsPref.reset();
    expect(effortLive()).toBe(false);
  });
});
