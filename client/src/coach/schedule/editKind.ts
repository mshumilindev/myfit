import type { ScheduleDoc } from './types';

export type ScheduleEditKind =
  'session-done' | 'session-missed' | 'session-cancelled' | 'session-edited';

/**
 * What a save changed, in the words of the activity log (a manager's device reports it; the server cannot read the sealed
 * document). Marks and cancellations win over a plain edit; anything else is an edit.
 */
export function editKindOf(prev: ScheduleDoc | undefined, next: ScheduleDoc): ScheduleEditKind {
  const before = new Map((prev?.exceptions ?? []).map((e) => [e.slotKey, e.status]));
  for (const e of next.exceptions) {
    if (before.get(e.slotKey) === e.status) continue;
    if (e.status === 'done') return 'session-done';
    if (e.status === 'missed') return 'session-missed';
  }
  const was = new Set(prev?.cancelled ?? []);
  if (next.cancelled.some((k) => !was.has(k))) return 'session-cancelled';
  return 'session-edited';
}
