import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * SPO-290 review S2: withdrawing a feature the trainer reads (injuries, the food log) also switches that trainer-sharing
 * category off, through the existing sharing call (`ClientCoachPort.setLevel`). The other features reach the trainer only
 * through the coach summary the store republishes without them (store.healthConsent tests).
 */
const h = vi.hoisted(() => ({ withdraw: vi.fn(), setLevel: vi.fn(), forget: vi.fn() }));
vi.mock('./consentApi', async () => {
  const real = await vi.importActual<typeof import('./consentApi')>('./consentApi');
  return { ...real, withdrawConsent: h.withdraw, grantConsent: vi.fn() };
});

vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  forgetShareLevel: h.forget,
}));

vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
}));

import { withdrawHealth } from './healthConsentActions';
import { configureClientCoach } from '../coach/client/data/config';
import { createUnavailableClientPort } from '../coach/data/unavailable';
import { isHealthOn, resetHealthGateForTests } from '../data/healthConsentGate';
import { HEALTH_FEATURES } from './consents';

beforeEach(() => {
  localStorage.clear();
  h.withdraw.mockReset().mockResolvedValue(undefined);
  h.setLevel.mockReset().mockResolvedValue(undefined);
  h.forget.mockReset();
  configureClientCoach({ port: { ...createUnavailableClientPort(), setLevel: h.setLevel } });
  resetHealthGateForTests(true);
});
afterEach(() => configureClientCoach({}));

describe('withdrawing stops the trainer reading the feature', () => {
  it('injuries -> the injury category goes off, nutrition -> the nutrition category', async () => {
    await withdrawHealth('injuries');
    await vi.waitFor(() => expect(h.setLevel).toHaveBeenCalledWith('injury', 'off'));
    await withdrawHealth('nutrition');
    await vi.waitFor(() => expect(h.setLevel).toHaveBeenCalledWith('nutrition', 'off'));
    expect(h.setLevel).toHaveBeenCalledTimes(2);
  });

  it('the other features have no trainer category of their own: nothing is called', async () => {
    for (const f of HEALTH_FEATURES.filter((x) => x !== 'injuries' && x !== 'nutrition'))
      await withdrawHealth(f);
    await new Promise((r) => setTimeout(r, 20));
    expect(h.setLevel).not.toHaveBeenCalled();
  });

  it('it never slows or breaks the withdrawal: a failing share call leaves the feature off and the record saved', async () => {
    h.setLevel.mockRejectedValue(new Error('offline'));
    expect(await withdrawHealth('injuries')).toBe(true);
    expect(isHealthOn('injuries')).toBe(false);
    expect(h.withdraw).toHaveBeenCalledWith(expect.objectContaining({ kind: 'health:injuries' }));
    await vi.waitFor(() => expect(h.setLevel).toHaveBeenCalledTimes(1));
  });

  it('with no trainer link (the unavailable port) the withdrawal is unaffected', async () => {
    configureClientCoach({});
    expect(await withdrawHealth('nutrition')).toBe(true);
    expect(isHealthOn('nutrition')).toBe(false);
  });
});

describe('withdrawing zeroes the stored on-device sharing level (fail to the private side)', () => {
  it('chronic, nicotine, alcohol, supplements each forget their own level, on this device, before the record is sent', async () => {
    const order: string[] = [];
    h.forget.mockImplementation((k: string) => order.push(`forget:${k}`));
    h.withdraw.mockImplementation(async () => void order.push('record'));
    for (const f of ['chronic', 'nicotine', 'alcohol', 'supplements'] as const)
      await withdrawHealth(f);
    expect(h.forget.mock.calls.map((c) => c[0])).toEqual([
      'conditions',
      'nicotine',
      'alcohol',
      'supplements',
    ]);
    expect(order.slice(0, 2)).toEqual(['forget:conditions', 'record']);
  });

  it('injuries, nutrition and cycle have no on-device level to forget (trainer grants go through setLevel)', async () => {
    for (const f of ['injuries', 'nutrition', 'cycle'] as const) await withdrawHealth(f);
    expect(h.forget).not.toHaveBeenCalled();
  });

  it('it zeroes even when the record cannot be sent (offline)', async () => {
    h.withdraw.mockRejectedValue(new Error('offline'));
    await withdrawHealth('nicotine');
    expect(h.forget).toHaveBeenCalledWith('nicotine');
  });
});
