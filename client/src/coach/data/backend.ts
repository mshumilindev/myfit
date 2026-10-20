import { useEffect, useState } from 'react';
import { classifyProblem, type CoachProblem } from './problem';
import { coachTestDefault, coachTestHooks } from './testHooks';

/**
 * Where Coach gets its data, kept free of Firebase so the Gym entry can import it. There is ONE backend in every app build
 * (dev server, preview, production): the real one. `VITE_COACH_BACKEND` only has two meanings:
 *   (unset)       try the real backend. In `npm run dev` a bounded, cached probe of one read callable (`probe.ts`) decides before the
 *                 adapters install, so the owner sees real data as soon as the backend is deployed; when it does not answer Coach
 *                 shows the kit error state with the reason (offline / not deployed / denied / timeout / unknown) and Retry.
 *   firestore     the same, without the probe (needs the deploy checklist of docs/COACH-BACKEND.md).
 *   off           Coach shows a calm "not configured" state and renders NO clients.
 * There is no demo, no sample data, no localStorage override and no setter here. Unit tests, Storybook and the QA screenshot
 * build put test doubles in through `testHooks.ts` (see there); that door does not exist in an app build.
 */
export type CoachBackendMode = 'firestore' | 'fixtures' | 'unconfigured';

export function coachBackendMode(): CoachBackendMode {
  if ((import.meta.env.VITE_COACH_BACKEND as string | undefined)?.trim() === 'off')
    return 'unconfigured';
  const hooks = coachTestHooks();
  if (hooks) return hooks.mode ?? 'fixtures';
  return 'firestore';
}

const isDev = (): boolean => !!import.meta.env.DEV && import.meta.env.MODE !== 'test';

/** Dev build, variable unset: the "auto" case, where the real backend is probed before it is installed. */
export function coachBackendIsAuto(): boolean {
  if (!isDev() || coachTestHooks()) return false;
  return !(import.meta.env.VITE_COACH_BACKEND as string | undefined)?.trim();
}

export const coachBackendIsReal = (): boolean => coachBackendMode() === 'firestore';
/** Explicitly switched off (`VITE_COACH_BACKEND=off`): nothing of Coach may render client data. */
export const coachIsUnconfigured = (): boolean => coachBackendMode() === 'unconfigured';

/**
 * The adapter a config module hands out before the real one is installed: a test double when the test hooks carry one and
 * the test did not ask for the real path, else the stand-in that only reports `unavailable` (never sample people).
 */
export function coachAdapter<T>(name: string, unavailable: () => T): T {
  const make = coachBackendIsReal() ? undefined : coachTestDefault<T>(name);
  return make ? make() : unavailable();
}

/** A probe problem as the port error code `classifyProblem` already understands. */
const probeCode = (p: CoachProblem): string => (p === 'denied' ? 'forbidden' : p);

export type BackendRole = 'trainer' | 'client' | 'manager';

export type BackendStatus = 'ready' | 'loading' | 'failed';

/** First load is bounded: a setup that has not finished by then is a failure with a reason, never an endless skeleton. */
export const BACKEND_START_TIMEOUT_MS = 8000;

/**
 * Where the ports behind the hooks stand. With the real backend the first render waits for the bootstrap module to install
 * them (milliseconds of module loading, no network). A failed install is `failed`, NEVER `ready`: the screens then show
 * an error with Retry, so sample data can never stand in for a real account's data (there is none in the app).
 * Unit tests (test doubles) are `ready` on the first render and nothing loads.
 */
export function useCoachBackendStatus(
  role: BackendRole,
  on: boolean,
  who?: { id: string | null; name: string },
): { status: BackendStatus; retry: () => void; problem: CoachProblem | null } {
  const need = on && coachBackendIsReal();
  const [status, setStatus] = useState<BackendStatus>(need ? 'loading' : 'ready');
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState<CoachProblem | null>(null);
  const id = who?.id ?? null;
  const name = who?.name ?? '';
  useEffect(() => {
    if (!need) return;
    let live = true;
    let release: (() => void) | null = null;
    // Reset to the loading state for a new account or an explicit retry (external-system sync).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading');
    setProblem(null);
    const timer = setTimeout(() => {
      if (!live) return;
      live = false; // a late success releases itself below
      setProblem('timeout');
      setStatus('failed');
    }, BACKEND_START_TIMEOUT_MS);
    const probe = coachBackendIsAuto()
      ? import('./probe').then(async (m) => {
          if (attempt > 0) m.resetBackendProbe();
          const r = await m.probeCoachBackend();
          if (!r.ok)
            throw Object.assign(new Error('probe'), {
              name: 'PortError',
              code: probeCode(r.problem),
            });
        })
      : Promise.resolve();
    void probe
      .then(() => import('./firestore/bootstrap'))
      .then((m) => m.acquireBackend(role, { id, name }))
      .then((r) => {
        clearTimeout(timer);
        if (live) {
          release = r;
          setStatus('ready');
        } else r();
      })
      .catch((e) => {
        clearTimeout(timer);
        if (!live) return;
        setProblem(classifyProblem(e));
        setStatus('failed');
      });
    return () => {
      live = false;
      clearTimeout(timer);
      release?.();
    };
  }, [need, role, id, name, attempt]);
  return {
    status: need ? status : 'ready',
    retry: () => setAttempt((n) => n + 1),
    problem: need && status === 'failed' ? (problem ?? 'unknown') : null,
  };
}

/** `true` when the ports behind the hooks are the final ones (see `useCoachBackendStatus`; a failure is not ready). */
export function useCoachBackendReady(
  role: BackendRole,
  on: boolean,
  who?: { id: string | null; name: string },
): boolean {
  return useCoachBackendStatus(role, on, who).status === 'ready';
}
