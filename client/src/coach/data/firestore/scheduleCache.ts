/**
 * The trainer's schedule (docs + requests), kept between launches (stale-while-revalidate) over the shared sealed snapshot
 * (`snapshotCache.ts`): shown at once on the next start, before the key rings arrive, replaced by the live data in the
 * background. `ScheduleData` is plain JSON (no Map / Set / Date), so it is stored as it is.
 */
import type { SealedLocal } from '../../chat/sealedLocal';
import type { ScheduleData } from '../../schedule/port';
import type { ScheduleCache } from '../../schedule/sealedPort';
import { snapshotOver } from './snapshotCache';

/** Bump when the shape of `ScheduleData` / `ScheduleDoc` changes in a way the old snapshot cannot be shown with. */
export const SCHEDULE_SCHEMA = 1;
/** Older than this is not shown as "last known" any more. */
export const SCHEDULE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isRec = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** Shape check of a decrypted snapshot: anything off is dropped, never shown. */
export function acceptSchedule(s: ScheduleData): boolean {
  if (!isRec(s) || !isNum(s.asOf)) return false;
  if (!Array.isArray(s.docs) || !Array.isArray(s.requests)) return false;
  const ids = new Set<string>();
  for (const d of s.docs as unknown[]) {
    if (!isRec(d) || !isStr(d.clientId) || !d.clientId || ids.has(d.clientId)) return false;
    ids.add(d.clientId);
    if (!isNum(d.rev)) return false;
    for (const k of ['patterns', 'oneOffs', 'exceptions', 'cancelled'])
      if (!Array.isArray(d[k])) return false;
  }
  for (const r of s.requests as unknown[]) {
    if (!isRec(r) || !isStr(r.id) || !isStr(r.clientId) || !isStr(r.slotKey)) return false;
    if (!isNum(r.fromStart) || !isNum(r.toStart) || !isNum(r.expiresAt) || !isStr(r.status))
      return false;
  }
  return true;
}

export function scheduleCacheOver(
  local: Promise<SealedLocal>,
  uid: string,
  o: { waitMs?: number; now?: () => number } = {},
): ScheduleCache {
  // the entry is bound to this trainer by `uid` (checked by `snapshotOver`): a snapshot of another account is dropped
  const c = snapshotOver<ScheduleData>(local, {
    key: `schedule:${uid}`,
    uid,
    schema: SCHEDULE_SCHEMA,
    maxAgeMs: SCHEDULE_MAX_AGE_MS,
    accept: acceptSchedule,
    ...o,
  });
  return {
    async get() {
      return (await c.get())?.value ?? null;
    },
    set: (d) => c.set(d, d.asOf),
  };
}
