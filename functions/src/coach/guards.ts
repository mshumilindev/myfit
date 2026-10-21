/**
 * Small guards shared by the coaching services (security review): display names copied into notices, and the counters that
 * cap how many notices / pushes a person or a caller can be made to produce. Counters live in `rateLimits/*`, which the
 * hourly sweep already empties after a day.
 */
import type { Kv } from './kv';

export const NAME_MAX = 60;

/**
 * A display name as it is COPIED into a notice or a response: control characters, zero-width and bidirectional override
 * marks removed, whitespace collapsed, at most NAME_MAX code points. The stored profile is untouched.
 */
const UNSAFE = new RegExp('[\\p{Cc}\\u200B-\\u200F\\u2028-\\u202E\\u2060-\\u2069\\uFEFF]', 'gu');

export function safeName(s: unknown): string {
  if (typeof s !== 'string') return '';
  const t = s.replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim();
  return [...t].slice(0, NAME_MAX).join('');
}

/**
 * Count one more event in the bucket `key`; false (and nothing counted) once `max` is reached. Not transactional on
 * purpose: the callers are one scheduler instance or one person's sequential calls, and an off-by-one only lets one extra
 * notice through.
 */
export async function takeSlot(kv: Kv, key: string, now: number, max: number): Promise<boolean> {
  const path = `rateLimits/${key}`;
  const cur = await kv.get(path);
  const n = Number(cur?.count ?? 0);
  if (n >= max) return false;
  await kv.set(path, { count: n + 1, updatedAt: now });
  return true;
}

export const HOUR = 3_600_000;
export const DAY_MS = 86_400_000;
/** reminder + unmarked notices (and their pushes) one person can receive per UTC day, whatever the schedules say */
export const REMINDERS_PER_DAY = 60;
/** activity reports one manager can send per hour */
export const REPORTS_PER_HOUR = 120;
/** team invites one person can create per hour (the pending cap bounds the total; this bounds create/revoke churn) */
export const INVITES_PER_HOUR = 30;
