import { getRole } from '../api';
import { useAddonOrBase } from '../addons/enabledSet';
import { canUseCoach } from './access';

/** Gate: the signed-in role is trainer or admin and the Coach app is there (base for a trainer, installed by an admin). */
export function useCoachAccess(): boolean {
  const coachApp = useAddonOrBase('coach');
  return canUseCoach(getRole()) && coachApp;
}
