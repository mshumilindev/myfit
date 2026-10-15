import { getRole } from '../api';
import { canUseCoach } from './access';

/** Gate: the signed-in role is trainer or admin. */
export function useCoachAccess(): boolean {
  return canUseCoach(getRole());
}
