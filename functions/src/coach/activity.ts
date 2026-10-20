/**
 * Team activity log (SPO-203 / SPO-238, ADR 005 decision 4): `teams/{teamId}/activity/{id}` holds METADATA only
 * (who, what kind, which client / request, status, when); never sealed content. Names resolve from the roster on the
 * device, times of sessions from the decrypted schedule. The owner reads everything; a manager reads own entries, or all
 * when the owner set `activityScope == 'all'` (firestore.rules). Retention: 90 days (swept by the scheduled job).
 */
import type { Kv } from './kv';

export const ACTIVITY_RETENTION_MS = 90 * 86_400_000;

/** Kinds a client device may report for a manager's own edit of the sealed schedule (the server cannot see inside). */
export const REPORTED_KINDS = [
  'session-done',
  'session-missed',
  'session-cancelled',
  'session-edited',
] as const;
export type ReportedKind = (typeof REPORTED_KINDS)[number];

export type ActivityKind =
  | ReportedKind
  | 'move-request'
  | 'move-cancel'
  | 'removal-request'
  | 'removal-approved'
  | 'removal-declined'
  | 'removal-cancelled'
  | 'member-added'
  | 'member-removed'
  | 'member-left'
  | 'client-invite';

export interface ActivityEntry {
  id: string;
  actorUid: string;
  role: 'trainer' | 'manager';
  kind: ActivityKind;
  clientId?: string;
  refId?: string;
  status?: string;
  ts: number;
}

/** The team a trainer belongs to (their own uid when they have no team yet). */
export async function teamIdOf(kv: Kv, trainerUid: string): Promise<string> {
  const u = await kv.get(`users/${trainerUid}`);
  return typeof u?.teamId === 'string' && u.teamId ? u.teamId : trainerUid;
}

export async function logActivity(
  kv: Kv,
  teamId: string,
  now: number,
  e: Omit<ActivityEntry, 'id' | 'ts'>,
): Promise<void> {
  const id = `${now}-${e.kind}-${(e.refId ?? e.clientId ?? '').slice(0, 24)}-${e.actorUid.slice(0, 8)}`;
  const entry: ActivityEntry = { ...e, id, ts: now };
  // drop undefined fields (Firestore rejects them)
  await kv.set(
    `teams/${teamId}/activity/${id}`,
    JSON.parse(JSON.stringify(entry)) as Record<string, unknown>,
  );
}
