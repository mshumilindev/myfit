import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HEALTH_ADDONS } from './addons/testSetup';
import { addonsPref } from './addons/enabledSet';
import type { HealthOnMap } from './data/healthConsentGate';
import { healthAddonsKey, healthAddonsOn } from './healthAddons';

const ALL_ON: HealthOnMap = {
  injuries: true,
  chronic: true,
  cycle: true,
  nicotine: true,
  alcohol: true,
  supplements: true,
  nutrition: true,
};

beforeEach(() => addonsPref.reset());
afterEach(() => addonsPref.reset());

describe('healthAddonsOn (consent AND add-on)', () => {
  it('turns each health feature off while its add-on is not installed', () => {
    const on = healthAddonsOn(ALL_ON);
    expect(on).toMatchObject({
      injuries: false,
      chronic: false,
      cycle: false,
      nicotine: false,
      alcohol: false,
      supplements: false,
    });
    expect(on.nutrition).toBe(true); // not a health add-on: untouched
  });

  it('keeps a feature on when both the consent and its add-on are there', () => {
    addonsPref.set(['health', 'conditions', 'nicotine-alcohol']);
    const on = healthAddonsOn(ALL_ON);
    expect(on).toMatchObject({ chronic: true, nicotine: true, alcohol: true, injuries: false });
  });

  it('never turns on what has no consent, installed or not', () => {
    addonsPref.set([...HEALTH_ADDONS]);
    const on = healthAddonsOn({ ...ALL_ON, injuries: false, cycle: false });
    expect(on).toMatchObject({ injuries: false, cycle: false, chronic: true });
  });

  it('changes its cache key when an add-on is installed', () => {
    const before = healthAddonsKey();
    addonsPref.set(['cycle']);
    expect(healthAddonsKey()).not.toBe(before);
  });
});
