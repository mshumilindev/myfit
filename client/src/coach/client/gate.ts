import { currentUid, getRole } from '../../api';
import { coachIsUnconfigured, useCoachBackendStatus, type BackendStatus } from '../data/backend';
import type { CoachProblem } from '../data/problem';
import { useFlag } from '../../data/flags';

/**
 * The client-side trainer features exist only behind the `coach` flag, and not for a trainer's own account. Kept tiny:
 * the real app imports this one eagerly, everything else of `coach/client` loads lazily (see `lazy.tsx`).
 * `status` is `failed` when the REAL backend could not be installed: the routes then say so (with Retry) instead of ever
 * falling back to anything else.
 */
export function useClientCoachBackend(): {
  on: boolean;
  status: BackendStatus;
  retry: () => void;
  problem: CoachProblem | null;
} {
  const flag = useFlag('coach');
  // A build with the backend switched off shows no trainer features at all (Routes shows the calm explanation).
  const on = flag && getRole() !== 'trainer' && !coachIsUnconfigured();
  // With the real backend (the default outside tests / Storybook) the adapters are installed first (no network); fixtures: ready at once.
  const { status, retry, problem } = useCoachBackendStatus('client', on, {
    id: on ? currentUid() : null,
    name: '',
  });
  return { on, status, retry, problem };
}

export function useClientCoachEnabled(): boolean {
  const { on, status } = useClientCoachBackend();
  return on && status === 'ready';
}
