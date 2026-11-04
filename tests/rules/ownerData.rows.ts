/**
 * SPO-58: the table of everything under `users/{userId}/…` and what its owner may do there.
 * Shared by the interpreter suite (ownerData.rules.test.ts) and the emulator parity suite (ownerData.emulator.test.ts),
 * so both are checked against the same expectations.
 */
import type { Op } from './engine/rulesEngine';
export const env = (ct = 'A'.repeat(120)) => ({
  v: 1,
  salt: 'A'.repeat(24),
  iv: 'A'.repeat(16),
  ct,
});
/** A sealed document the client writes: only the stamp in the open, the rest inside `enc`. */
export const stamped = () => ({ updatedAt: 5, enc: env() });

export interface Row {
  /** pattern under users/{userId}, e.g. `/meta/goals` */
  pattern: string;
  /** a concrete path below users/OWNER */
  path: string;
  /** operations the owner may do (with `valid` as the written data) */
  owner: Op[];
  /** data that satisfies the write rule (omit when the owner cannot write) */
  valid?: Record<string, unknown>;
  /** the stored document the write starts from (default: `valid` with a stamp) */
  before?: Record<string, unknown>;
}

export const SEALED_META = [
  'goals',
  'home',
  'mastery',
  'coach',
  'exercisePrefs',
  'sleepPrefs',
  'widgetData',
  'challenges',
  'atlasChatState',
  'selfCoach',
  'calendarSettings',
] as const;
export const ALL: Op[] = ['get', 'list', 'create', 'update', 'delete'];
const READ_DELETE: Op[] = ['get', 'list', 'delete'];
const READ_ONLY: Op[] = ['get', 'list'];

export const ROWS: Row[] = [
  { pattern: '/sessionState/{deviceId}', path: 'sessionState/d1', owner: ['get'] },
  { pattern: '/workouts/{workoutId}', path: 'workouts/w1', owner: ALL, valid: { id: 'w1' } },
  { pattern: '/gyms/{gymId}', path: 'gyms/g1', owner: ALL, valid: { id: 'g1' } },
  { pattern: '/restPeriods/{periodId}', path: 'restPeriods/r1', owner: ALL, valid: { id: 'r1' } },
  { pattern: '/injuries/{injuryId}', path: 'injuries/i1', owner: ALL, valid: { id: 'i1' } },
  { pattern: '/conditions/{conditionId}', path: 'conditions/c1', owner: ALL, valid: { id: 'c1' } },
  { pattern: '/activities/{activityId}', path: 'activities/a1', owner: ALL, valid: { id: 'a1' } },
  { pattern: '/sleeps/{sleepId}', path: 'sleeps/s1', owner: ALL, valid: { id: 's1' } },
  { pattern: '/meta/{docId}', path: 'meta/body', owner: ALL, valid: { updatedAt: 5 } },
  { pattern: '/meta/chatKeys', path: 'meta/chatKeys', owner: ALL, valid: { v: 1, enc: env() } },
  { pattern: '/meta/signalState', path: 'meta/signalState', owner: ALL, valid: stamped() },
  ...SEALED_META.map((m) => ({
    pattern: `/meta/${m}`,
    path: `meta/${m}`,
    owner: ALL,
    valid: stamped(),
  })),
  {
    pattern: '/atlasChat/{msgId}',
    path: 'atlasChat/m1',
    owner: ALL,
    valid: { id: 'm1', at: 1, updatedAt: 2, enc: env() },
  },
  { pattern: '/pings/{pingId}', path: 'pings/p1', owner: READ_DELETE },
  { pattern: '/grants/{coachId}', path: 'grants/c1', owner: ALL, valid: { v: 1 } },
  { pattern: '/push/{deviceId}', path: 'push/d1', owner: ALL, valid: { token: 'tok' } },
  {
    pattern: '/outbox/{messageId}',
    path: 'outbox/o1',
    owner: ALL,
    valid: { dueAt: 5, title: 't', body: 'b' },
  },
  { pattern: '/reminderDismissals/{dismissId}', path: 'reminderDismissals/x', owner: READ_DELETE },
  {
    pattern: '/notices/{noticeId}',
    path: 'notices/n1',
    owner: ['get', 'list', 'update'],
    valid: { updatedAt: 1, readAt: 5 },
    before: { updatedAt: 1, readAt: null },
  },
  { pattern: '/audit/{entryId}', path: 'audit/e1', owner: READ_ONLY },
  { pattern: '/trainerNotes/{noteId}', path: 'trainerNotes/t1', owner: READ_ONLY },
  {
    pattern: '/clientNotes/{noteId}',
    path: 'clientNotes/n1',
    owner: ALL,
    valid: { id: 'n1', clientId: 'c', at: 1, updatedAt: 2, enc: env() },
  },
  {
    pattern: '/decisions/{decisionId}',
    path: 'decisions/d1',
    owner: ALL,
    valid: { id: 'd1', clientId: 'c', kind: 'k', status: 's', enc: env() },
  },
  {
    pattern: '/decisions/{decisionId}/evidence/{cat}',
    path: 'decisions/d1/evidence/sleep',
    owner: ALL,
    valid: { category: 'sleep', enc: env() },
  },
  {
    pattern: '/shares/{category}',
    path: 'shares/sleep',
    owner: ALL,
    valid: { category: 'sleep', level: 'full', asOf: 1, v: 1, enc: env() },
  },
  { pattern: '/consentLog/{entryId}', path: 'consentLog/e1', owner: READ_ONLY },
  { pattern: '/consentRecords/{recordId}', path: 'consentRecords/r1', owner: READ_ONLY },
];

/** Every `match` below users/{userId}, as `/a/{x}/b/{y}`. */
