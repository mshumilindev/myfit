/**
 * The trainer's calendar settings, sealed: `users/{trainer}/meta/calendarSettings`, key = the trainer's own vault key
 * ('dek'). Open fields are only `updatedAt`; working hours, chosen gyms and the range mode are inside the envelope.
 * `sealOrThrow` refuses (vault-locked) instead of writing plaintext.
 */
import type { Vault } from '../../../autoVault';
import { openSealed, sealOrThrow } from '../../../coachCrypto/sealOrThrow';
import type { CalendarSettingsPort } from '../../schedule/calendarSettings';
import { sanitizeSettings } from '../../schedule/hours';
import type { FsApi } from './fsApi';

export const calendarSettingsPath = (uid: string): string => `users/${uid}/meta/calendarSettings`;

export function createSealedCalendarSettingsPort(d: {
  fs: FsApi;
  vault: Vault;
  uid: string;
}): CalendarSettingsPort {
  const path = calendarSettingsPath(d.uid);
  return {
    async load() {
      const raw = await d.fs.get(path);
      if (!raw) return null;
      return sanitizeSettings(await openSealed('calendarSettings', raw, { vault: d.vault }));
    },
    async save(s) {
      const doc = await sealOrThrow(
        'calendarSettings',
        { updatedAt: d.fs.now(), v: s.v, working: s.working, gymIds: s.gymIds, range: s.range },
        { vault: d.vault },
      );
      await d.fs.set(path, doc);
    },
  };
}
