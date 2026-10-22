import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeHealthPrompt,
  healthPromptFeature,
  healthSnapshot,
  healthVersion,
  isHealthOn,
  openHealthPrompt,
  resetHealthGateForTests,
  setHealthConsentState,
  settleHealthLocally,
  shouldAutoAskHealth,
  subscribeHealth,
  withdrawHealthLocally,
} from './healthConsentGate';
import { HEALTH_FEATURES, type HealthFeature } from '../legal/consents';

const map = (on: Partial<Record<HealthFeature, boolean>>) =>
  Object.fromEntries(HEALTH_FEATURES.map((f) => [f, on[f] ?? false])) as Record<
    HealthFeature,
    boolean
  >;

beforeEach(() => resetHealthGateForTests(false));

describe('health consent gate', () => {
  it('starts off for every feature and not ready (fail closed)', () => {
    for (const f of HEALTH_FEATURES) expect(isHealthOn(f)).toBe(false);
    expect(healthSnapshot().ready).toBe(false);
  });

  it('follows the records per feature, and notifies only on a real change', () => {
    const l = vi.fn();
    const off = subscribeHealth(l);
    const v = healthVersion();
    setHealthConsentState({
      on: map({ alcohol: true }),
      answered: map({ alcohol: true }),
      ready: true,
    });
    expect(isHealthOn('alcohol')).toBe(true);
    expect(isHealthOn('nicotine')).toBe(false);
    expect(healthVersion()).toBe(v + 1);
    setHealthConsentState({
      on: map({ alcohol: true }),
      answered: map({ alcohol: true }),
      ready: true,
    });
    expect(healthVersion()).toBe(v + 1);
    expect(l).toHaveBeenCalledTimes(1);
    off();
  });

  it('a withdrawal stops the feature on this device before the record comes back, and a later report does not undo it', () => {
    setHealthConsentState({
      on: map({ cycle: true }),
      answered: map({ cycle: true }),
      ready: true,
    });
    withdrawHealthLocally('cycle');
    expect(isHealthOn('cycle')).toBe(false);
    setHealthConsentState({
      on: map({ cycle: true }),
      answered: map({ cycle: true }),
      ready: true,
    });
    expect(isHealthOn('cycle')).toBe(false);
    settleHealthLocally('cycle');
    expect(isHealthOn('cycle')).toBe(true);
  });

  it('asks once at the first entry: only when ready, never asked, not "Not now", nothing else open', () => {
    expect(shouldAutoAskHealth('nicotine')).toBe(false); // records unknown
    setHealthConsentState({ on: map({}), answered: map({ alcohol: true }), ready: true });
    expect(shouldAutoAskHealth('nicotine')).toBe(true);
    expect(shouldAutoAskHealth('alcohol')).toBe(false); // answered before (granted or withdrawn)
    openHealthPrompt('nicotine');
    expect(healthPromptFeature()).toBe('nicotine');
    expect(shouldAutoAskHealth('cycle')).toBe(false); // one prompt at a time
    closeHealthPrompt(true);
    expect(healthPromptFeature()).toBeNull();
    expect(shouldAutoAskHealth('nicotine')).toBe(false); // "Not now": quiet until the next visit
    expect(shouldAutoAskHealth('cycle')).toBe(true);
  });
});
