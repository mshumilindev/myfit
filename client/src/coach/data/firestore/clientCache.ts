/**
 * The client's coaching state (link, consent, program layer), kept between launches (stale-while-revalidate) over the
 * shared sealed snapshot (`snapshotCache.ts`).
 */
import type { SealedLocal } from '../../chat/sealedLocal';
import type { ClientSnapshot } from '../../client/data/types';
import { snapshotOver } from './snapshotCache';

export const CLIENT_SCHEMA = 1;
export const CLIENT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function clientCacheOver(
  local: Promise<SealedLocal>,
  uid: string,
  o: { waitMs?: number; now?: () => number } = {},
) {
  const c = snapshotOver<ClientSnapshot>(local, {
    key: `client:${uid}`,
    uid,
    schema: CLIENT_SCHEMA,
    maxAgeMs: CLIENT_MAX_AGE_MS,
    accept: (s) => typeof s.asOf === 'number' && !!s.link && typeof s.link === 'object',
    ...o,
  });
  return {
    async get(): Promise<ClientSnapshot | null> {
      return (await c.get())?.value ?? null;
    },
    set: (s: ClientSnapshot) => c.set(s, s.asOf),
  };
}
