/** Records the gym-search consent (shared by its own prompt and the legal-gate page). True once the server has it. */
import { currentUid } from '../api';
import { closeGeoPrompt, GEO_ENGINES, setGeoOverride } from '../data/geoSearchGate';
import { grantConsent } from './consentApi';
import { clearLocalOff } from './localOff';
import { prepareDirectGrant } from './signupConsents';

export async function grantGeoSearch(): Promise<boolean> {
  try {
    const commit = await prepareDirectGrant('geo-search');
    await grantConsent({ kind: 'geo-search', engines: [...GEO_ENGINES] });
    commit(); // only now may an unsent withdrawal of this kind be dropped
    clearLocalOff(currentUid(), 'geo-search');
    setGeoOverride(true); // a stop left over from an unsent withdrawal must not outlive this newer grant
    closeGeoPrompt();
    return true;
  } catch {
    return false;
  }
}
