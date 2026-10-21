import { getRole } from '../api';
import { canUseCoach } from '../coach/access';
import { coachHash } from '../coach/routes';
import { currentHash, replaceHash } from '../route';
import { isLegacyPeopleClients } from './rosterAccess';

/**
 * The retired People "Clients" address (bookmarks, old links, a pasted URL, Back to an old entry): trainers and admins
 * land on Coach clients instead (SPO-141). Called before the screen state reads the URL and on every pop.
 */
export function redirectLegacyPeopleClients(): void {
  if (isLegacyPeopleClients(currentHash()) && canUseCoach(getRole()))
    replaceHash(coachHash({ screen: 'clients' }));
}
