import { getRole } from '../api';
import { useFlag } from '../data/flags';
import { canUseCoach } from './access';

/** Reactive gate: signed-in role is trainer or admin AND the `coach` flag is on. */
export function useCoachAccess(): boolean {
  const flagOn = useFlag('coach');
  return canUseCoach(getRole(), flagOn);
}
