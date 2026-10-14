import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const callFn = vi.fn();
let uid: string | null = 'u1';
vi.mock('../../api', () => ({ callFn: (...a: unknown[]) => callFn(...a), currentUid: () => uid }));

import {
  PROBE_FAIL_TTL_MS,
  PROBE_OK_TTL_MS,
  PROBE_TIMEOUT_MS,
  probeCoachBackend,
  resetBackendProbe,
} from './probe';

beforeEach(() => {
  uid = 'u1';
  callFn.mockReset();
  resetBackendProbe();
});
afterEach(() => resetBackendProbe());

describe('probeCoachBackend', () => {
  it('asks one cheap read callable with a short bound', async () => {
    callFn.mockResolvedValue({ link: null });
    expect(await probeCoachBackend()).toEqual({ ok: true });
    expect(callFn).toHaveBeenCalledWith(
      'coachMyLink',
      {},
      { quiet: true, timeoutMs: PROBE_TIMEOUT_MS },
    );
    expect(PROBE_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });

  it('a signed-out session is never real and asks nothing', async () => {
    uid = null;
    expect(await probeCoachBackend()).toEqual({ ok: false, problem: 'denied' });
    expect(callFn).not.toHaveBeenCalled();
  });

  it('classifies failures: not deployed, denied, timeout', async () => {
    callFn.mockRejectedValueOnce({ code: 'functions/not-found' });
    expect(await probeCoachBackend()).toEqual({ ok: false, problem: 'not-deployed' });
    resetBackendProbe();
    callFn.mockRejectedValueOnce({ code: 'functions/permission-denied' });
    expect(await probeCoachBackend()).toEqual({ ok: false, problem: 'denied' });
    resetBackendProbe();
    callFn.mockRejectedValueOnce({ code: 'functions/deadline-exceeded' });
    expect(await probeCoachBackend()).toEqual({ ok: false, problem: 'timeout' });
  });

  it('caches: a success for minutes, a failure briefly, concurrent callers share one request', async () => {
    let t = 1_000;
    const now = () => t;
    callFn.mockResolvedValue({});
    const [a, b] = await Promise.all([probeCoachBackend(now), probeCoachBackend(now)]);
    expect(a).toEqual(b);
    expect(callFn).toHaveBeenCalledTimes(1);
    t += PROBE_OK_TTL_MS - 1;
    await probeCoachBackend(now);
    expect(callFn).toHaveBeenCalledTimes(1);
    t += 2;
    await probeCoachBackend(now);
    expect(callFn).toHaveBeenCalledTimes(2);

    resetBackendProbe();
    callFn.mockReset();
    callFn.mockRejectedValue({ code: 'functions/not-found' });
    await probeCoachBackend(now);
    t += PROBE_FAIL_TTL_MS - 1;
    await probeCoachBackend(now);
    expect(callFn).toHaveBeenCalledTimes(1);
    t += 2;
    callFn.mockResolvedValue({});
    expect(await probeCoachBackend(now)).toEqual({ ok: true });
    expect(callFn).toHaveBeenCalledTimes(2);
  });
});
