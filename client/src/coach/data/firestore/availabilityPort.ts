/**
 * The real `AvailabilityPort`: `coachRead({ share: true })` returns the sealed view the client's device published (the
 * server hands it only to the active trainer of that client and audits it), the grant opens it on this device, and only
 * the `availability` part is kept, cleaned by `parseAvailability`. A view that does not open (no grant yet, locked vault,
 * key of an older pair) reads as "not shared": the client's device repairs the grant by itself.
 */
import type { Vault } from '../../../autoVault';
import { unsealDoc } from '../../../encryptedDoc';
import { openAthleteKey } from '../../../vaultGrants';
import type { CoachKeyRecord } from '../../../vaultShare';
import { parseAvailability } from '../../domain/availability';
import type { AvailabilityPort } from '../availability';
import { toPortError } from './errors';
import type { FsApi, Raw } from './fsApi';

export interface AvailabilityPortDeps {
  fs: FsApi;
  vault: Vault;
  loadOwnCoachKey: () => Promise<CoachKeyRecord | null>;
}

interface ShareResponse {
  coachShare?: Raw | null;
  grant?: unknown;
}

export function createFirestoreAvailabilityPort(d: AvailabilityPortDeps): AvailabilityPort {
  return {
    async read(clientId) {
      let res: ShareResponse;
      try {
        res = await d.fs.call<ShareResponse>('coachRead', {
          clientId,
          categories: [],
          share: true,
          via: 'client360',
        });
      } catch (e) {
        throw toPortError(e);
      }
      if (!res.coachShare) return { state: 'not-shared' };
      const key = await openAthleteKey(d.vault, res.grant, { loadOwnCoachKey: d.loadOwnCoachKey });
      if (!key) return { state: 'not-shared' };
      try {
        const doc = await unsealDoc<{ view?: { availability?: unknown } }>(res.coachShare, key.key);
        const availability = parseAvailability(doc.view?.availability);
        return availability ? { state: 'shared', availability } : { state: 'not-shared' };
      } catch {
        return { state: 'not-shared' };
      }
    },
  };
}
