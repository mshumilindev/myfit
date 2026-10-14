/** The real `ReadLogPort`: `coachLogRead` records reads that never reach the server (views of cached data, exports). */
import type { ReadLogPort } from '../readLog';
import type { FsApi } from './fsApi';

export function createFirestoreReadLog(fs: FsApi): ReadLogPort {
  return {
    logRead(e) {
      // fire and forget: a failed log write must never break the screen (the server also logs every coachRead)
      void fs
        .call('coachLogRead', { clientId: e.clientId, category: e.category, via: e.via })
        .catch(() => undefined);
    },
  };
}
