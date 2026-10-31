/**
 * Registry of the NEW coaching collections (plan-backend 6.1, R-BE-KEY-3).
 *
 * Every field of a document is declared either `open` (readable by rules, queries and
 * functions) or `enc` (inside the sealed envelope). Anything undeclared is refused by
 * `splitFields`, so a new field cannot slip into the open by accident. Open lists are
 * reviewed in PR; `newCollections.test.ts` checks them against the rules file.
 *
 * key: 'ck'   = conversation sub-key (client + trainer)
 *      'dek'  = the owner's own vault key
 *      'none' = no user text, nothing sealed
 */
import type { Purpose } from './conversationKey';

export type KeyKind = 'ck' | 'dek' | 'none';

export interface NewCollectionSpec {
  path: string;
  key: KeyKind;
  /** Purpose sub-key, for key 'ck'. */
  purpose?: Purpose;
  /** AAD document class, for key 'ck' (never changes once data exists). */
  aadKind?: string;
  /** Sealed payload cap in bytes for key 'ck' (default: the chat cap of envelope.ts). */
  maxBytes?: number;
  open: readonly string[];
  enc: readonly string[];
}

/** plan-backend R-BE-DB-4: plan documents stay below 200 KB (a version holds a whole program). */
/** @internal planned: size cap the rules mirror. Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export const PLAN_MAX_BYTES = 180_000;

/**
 * A schedule is ONE document per client (rev check + transaction + a single listener), so it is not chunked
 * by week/month: chunking would split the atomic `rev` and make a partial read possible. It grows with
 * one-offs/exceptions only (about 100 bytes each), so 120 KB holds well over a thousand entries and stays far below
 * the 1 MiB Firestore document limit. The rules function `sealedCkSchedule` matches this constant (drift test).
 */
/** @internal planned: size cap the rules mirror. Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export const SCHEDULE_MAX_BYTES = 120_000;

export const NEW_COLLECTIONS = {
  conversations: {
    path: 'conversations/{cid}',
    key: 'none',
    open: [
      'clientId',
      'trainerId',
      'active',
      'ck',
      'lastAt',
      'lastFrom',
      'unread',
      'readUpTo',
      'clearedBefore',
      'keyEpoch',
      'createdAt',
    ],
    enc: [],
  },
  messages: {
    path: 'conversations/{cid}/messages/{mid}',
    key: 'ck',
    purpose: 'chat',
    aadKind: 'message',
    open: [
      'id',
      'from',
      'at',
      'v',
      'keyEpoch',
      'del',
      'deleted',
      'deletedAt',
      'sig',
      'sigKid',
      'k',
      'r',
    ],
    enc: ['kind', 'text', 'share', 'reqId', 'sys', 'cats', 'result'],
  },
  notes: {
    path: 'conversations/{cid}/notes/{nid}',
    key: 'ck',
    purpose: 'notes',
    aadKind: 'note',
    open: ['id', 'by', 'at', 'updatedAt', 'keyEpoch', 'del'],
    enc: ['text', 'anchor'],
  },
  // Sealed by the REQUESTER with the conversation key; the other party only moves the open
  // `status`/`decidedAt`; a counter-proposal is a new request with `supersedes`. Functions never
  // hold the key (they validate open fields, expire via `expiresAt`, send content-free notices).
  requests: {
    path: 'conversations/{cid}/requests/{rid}',
    key: 'ck',
    purpose: 'requests',
    aadKind: 'request',
    open: [
      'id',
      'from',
      'status',
      'createdAt',
      'decidedAt',
      'expiresAt',
      'slotKey',
      'supersedes',
      'keyEpoch',
      'via',
    ],
    enc: ['slotRef', 'proposed', 'note', 'byName'],
  },
  schedules: {
    path: 'schedules/{clientId}',
    key: 'ck',
    purpose: 'schedule',
    aadKind: 'schedule',
    maxBytes: SCHEDULE_MAX_BYTES,
    open: ['clientId', 'trainerId', 'rev', 'updatedAt', 'keyEpoch'],
    enc: ['patterns', 'oneOffs', 'exceptions', 'cancelled', 'tz', 'gymNames'],
  },
  // Wraps of PAST conversation-key epochs for the trainer's key (no user text, nothing sealed here: the wrap is itself
  // the ciphertext). Written by the client device only; the end function deletes the whole ring.
  keyring: {
    path: 'conversations/{cid}/keyring/{epoch}',
    key: 'none',
    open: ['epoch', 'ck', 'at'],
    enc: [],
  },
  plans: {
    path: 'plans/{clientId}',
    key: 'ck',
    purpose: 'plan',
    aadKind: 'plan',
    maxBytes: PLAN_MAX_BYTES,
    open: ['clientId', 'trainerId', 'programId', 'liveVersion', 'rev', 'updatedAt', 'keyEpoch'],
    enc: ['trainerDays', 'targets', 'activities', 'dayNotes'],
  },
  versions: {
    path: 'plans/{clientId}/versions/{n}',
    key: 'ck',
    purpose: 'plan',
    aadKind: 'planVersion',
    maxBytes: PLAN_MAX_BYTES,
    open: ['n', 'programId', 'state', 'createdAt', 'publishedAt', 'keyEpoch'],
    enc: ['reason', 'summary', 'diff', 'overlay'],
  },
  liveSessions: {
    path: 'liveSessions/{athleteId} (extension)',
    key: 'ck',
    purpose: 'live',
    aadKind: 'live',
    open: ['id', 'trainerId', 'startedAt', 'updatedAt', 'finishedAt', 'expireAt', 'keyEpoch'],
    // nothing about sets, loads, notes or exercise names while a session runs; the final totals exist only after it ended
    enc: [
      'athleteName',
      'gymName',
      'exerciseCount',
      'sessionName',
      'lastName',
      'lastSets',
      'lastTonnageKg',
      'lastAt',
      'finalSets',
      'finalTonnageKg',
    ],
  },
  clientNotes: {
    path: 'users/{trainer}/clientNotes/{nid}',
    key: 'dek',
    open: ['id', 'clientId', 'at', 'updatedAt', 'del'],
    enc: ['text', 'anchor'],
  },
  decisions: {
    path: 'users/{trainer}/decisions/{id}',
    key: 'dek',
    open: ['id', 'clientId', 'kind', 'status', 'decidedAt', 'windowEndsAt'],
    enc: [
      'signal',
      'optionId',
      'diff',
      'message',
      'outcome',
      'e1rmBefore',
      'e1rmAfter',
      'noiseKg',
      'notes',
    ],
  },
  evidence: {
    path: 'users/{trainer}/decisions/{id}/evidence/{cat}',
    key: 'dek',
    open: ['category'],
    enc: ['rows'],
  },
  signalState: {
    path: 'users/{trainer}/meta/signalState',
    key: 'dek',
    open: ['updatedAt'],
    enc: ['snoozed', 'dismissed'],
  },
  // The member's own marker of the days they train "with my coach" when they have no in-app trainer (decision 6).
  selfCoach: {
    path: 'users/{client}/meta/selfCoach',
    key: 'dek',
    open: ['updatedAt'],
    enc: ['days'],
  },
  // The trainer's calendar settings (working hours per weekday, the gyms they work at, the visible range).
  calendarSettings: {
    path: 'users/{trainer}/meta/calendarSettings',
    key: 'dek',
    open: ['updatedAt'],
    enc: ['v', 'working', 'gymIds', 'range'],
  },
  shares: {
    path: 'users/{client}/shares/{category}',
    key: 'dek',
    open: ['category', 'level', 'asOf', 'v'],
    enc: ['view'],
  },
} as const satisfies Record<string, NewCollectionSpec>;

export type NewCollectionName = keyof typeof NEW_COLLECTIONS;

/**
 * Splits a document into its open fields and the secret remainder. Strict: a field that is
 * declared nowhere throws, and `enc` / `undefined` values never pass through.
 */
export function splitFields(
  name: NewCollectionName,
  doc: Record<string, unknown>,
): { open: Record<string, unknown>; secret: Record<string, unknown> } {
  const spec: NewCollectionSpec = NEW_COLLECTIONS[name];
  const open: Record<string, unknown> = {};
  const secret: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v === undefined) continue; // Firestore rejects undefined
    if (spec.open.includes(k)) open[k] = v;
    else if (spec.enc.includes(k)) secret[k] = v;
    else throw new Error(`undeclared-field:${name}.${k}`);
  }
  return { open, secret };
}
