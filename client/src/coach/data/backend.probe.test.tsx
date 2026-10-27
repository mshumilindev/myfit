import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCoachBackendStatus } from './backend';
import { setCoachBackendMode } from '../__fixtures__/register';
import type { ProbeResult } from './probe';

// SPO-364: in `npm run dev` ("auto") a bounded probe runs before the real adapters install. A slow COLD START of the function
// (no answer in 4 s) or no connection says nothing about whether Coach is deployed, so it must not block the screens: they
// install the offline-first adapters and show the snapshot kept on the device. Only a definite answer fails the start.
const gate = vi.hoisted(() => ({ result: { ok: true } as ProbeResult }));
vi.mock('./probe', () => ({
  probeCoachBackend: vi.fn(async () => gate.result),
  resetBackendProbe: vi.fn(),
}));
const acquire = vi.hoisted(() => vi.fn(() => Promise.resolve(() => undefined)));
vi.mock('./firestore/bootstrap', () => ({ acquireBackend: acquire }));

beforeEach(() => {
  vi.stubEnv('MODE', 'development');
  vi.stubEnv('DEV', true);
  vi.stubEnv('PROD', false);
  vi.stubEnv('VITE_COACH_BACKEND', '');
  // auto mode needs no test hooks: the real path is selected by the (stubbed) env
  setCoachBackendMode(null);
  acquire.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  setCoachBackendMode(null);
});

async function start(result: ProbeResult) {
  gate.result = result;
  const r = renderHook(() => useCoachBackendStatus('trainer', true, { id: 'u1', name: 'T' }));
  await act(async () => {
    await new Promise((res) => setTimeout(res, 20));
  });
  return r.result.current;
}

describe('dev auto probe', () => {
  it.each(['timeout', 'offline'] as const)(
    'a probe that %s still installs the backend',
    async (problem) => {
      const s = await start({ ok: false, problem });
      expect(acquire).toHaveBeenCalledTimes(1);
      expect(s.status).toBe('ready');
      expect(s.problem).toBeNull();
    },
  );
  it.each(['not-deployed', 'denied'] as const)(
    'a definite "%s" still fails with the reason',
    async (problem) => {
      const s = await start({ ok: false, problem });
      expect(acquire).not.toHaveBeenCalled();
      expect(s.status).toBe('failed');
      expect(s.problem).toBe(problem);
    },
  );
});
