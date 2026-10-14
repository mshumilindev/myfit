/**
 * The quick probe of the real Coach backend, run ONCE (cached) before the real adapters are installed when the build is a
 * dev build with `VITE_COACH_BACKEND` unset ("auto": try the real backend first). One cheap read callable (`coachMyLink`, open
 * to every signed-in role) answers within `PROBE_TIMEOUT_MS`:
 *   ok     -> the real adapters install and the owner sees real data as soon as the backend is deployed;
 *   failed -> the kit error state with the reason (offline / not deployed / denied / timeout).
 * Never silent: the result is either real data or an error, never sample people mixed in. A signed-out session cannot be
 * real, so it fails as `denied` without a request. Results are cached (a success for 5 min, a failure for 20 s) so the
 * screens of one visit do not each wait; Retry clears the cache.
 */
import { callFn, currentUid } from '../../api';
import { classifyProblem, type CoachProblem } from './problem';

export const PROBE_TIMEOUT_MS = 4000;
export const PROBE_OK_TTL_MS = 5 * 60_000;
export const PROBE_FAIL_TTL_MS = 20_000;

export type ProbeResult = { ok: true } | { ok: false; problem: CoachProblem };

let cache: { at: number; uid: string | null; result: ProbeResult } | null = null;
let inflight: Promise<ProbeResult> | null = null;

export function resetBackendProbe(): void {
  cache = null;
  inflight = null;
}

export async function probeCoachBackend(now: () => number = Date.now): Promise<ProbeResult> {
  const uid = currentUid();
  if (!uid) return { ok: false, problem: 'denied' };
  if (cache && cache.uid === uid) {
    const ttl = cache.result.ok ? PROBE_OK_TTL_MS : PROBE_FAIL_TTL_MS;
    if (now() - cache.at < ttl) return cache.result;
  }
  if (inflight) return inflight;
  inflight = (async (): Promise<ProbeResult> => {
    let result: ProbeResult;
    try {
      await callFn('coachMyLink', {}, { quiet: true, timeoutMs: PROBE_TIMEOUT_MS });
      result = { ok: true };
    } catch (e) {
      result = { ok: false, problem: classifyProblem(e) };
    }
    cache = { at: now(), uid, result };
    return result;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
