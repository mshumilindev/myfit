/**
 * Coaching server logic, PURE (no firebase imports): everything here is unit-tested without an emulator.
 * Plan refs: plan-backend sections 2 (relationship), 4 (consent), 5 (audit), 11 (requests), plan-security C.2/C.3.
 */
import { createHash, createHmac } from 'node:crypto';

export const DAY = 86_400_000;
export const HOUR = 3_600_000;

export type Level = 'off' | 'effects' | 'full';
export const LEVELS: readonly Level[] = ['off', 'effects', 'full'];
export type Category = 'totals' | 'sets' | 'body' | 'sleep' | 'injury' | 'nutrition' | 'checkins';
export const CATEGORIES: readonly Category[] = [
  'totals',
  'sets',
  'body',
  'sleep',
  'injury',
  'nutrition',
  'checkins',
];
export type Consent = Record<Category, Level>;
export type CoachMode = 'app' | 'hybrid' | 'program';
export const MODES: readonly CoachMode[] = ['app', 'hybrid', 'program'];
export type CoachStatus = 'pending' | 'active' | 'ended';

export const ALL_OFF: Consent = {
  totals: 'off',
  sets: 'off',
  body: 'off',
  sleep: 'off',
  injury: 'off',
  nutrition: 'off',
  checkins: 'off',
};

export interface CoachingDoc {
  clientId: string;
  trainerId: string;
  status: CoachStatus;
  mode: CoachMode;
  consent: Consent;
  consentVersion: number;
  keyEpoch: number;
  inviteId: string | null;
  createdAt: number;
  acceptedAt: number | null;
  endedAt: number | null;
  endedBy: 'client' | 'trainer' | 'admin' | null;
  updatedAt: number;
}

/* ---- ids ---------------------------------------------------------------------------------------------------- */
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
export const CID_LENGTH = 26;
export const isCid = (s: unknown): s is string => typeof s === 'string' && /^[a-z2-7]{26}$/.test(s);
export const isUid = (s: unknown): s is string =>
  typeof s === 'string' && s.length >= 1 && s.length <= 128 && !s.includes('/');

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let acc = 0;
  let out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
  return out;
}

/**
 * cid = base32(HMAC-SHA256(pepper, clientUid ':' trainerUid))[0..26] (plan-security C.2 no. 1). Byte-identical to the
 * client's `computeConversationId` (tested). `pepper` is >= 32 random bytes held in Secret Manager.
 */
export function conversationId(pepper: Uint8Array, clientUid: string, trainerUid: string): string {
  if (pepper.length < 32) throw new Error('weak-pepper');
  if (
    !isUid(clientUid) ||
    !isUid(trainerUid) ||
    clientUid.includes(':') ||
    trainerUid.includes(':')
  )
    throw new Error('bad-uid');
  const mac = createHmac('sha256', pepper).update(`${clientUid}:${trainerUid}`).digest();
  return base32(mac).slice(0, CID_LENGTH);
}

/** Fingerprint of a coach public key: same bytes as the client's `fingerprint()` (first 8 bytes of SHA-256(crv|x|y), hex). */
export function keyFingerprint(pub: { crv?: string; x?: string; y?: string }): string {
  return createHash('sha256')
    .update(`${pub.crv}|${pub.x}|${pub.y}`)
    .digest()
    .subarray(0, 8)
    .toString('hex');
}

/* ---- invites (R-BE-REL-2/4) -------------------------------------------------------------------------------- */
export const INVITE_TTL = 7 * DAY;
export const MAX_PENDING_INVITES = 50;
export const MAX_INVITES_PER_DAY = 20;

export interface CoachInviteDoc {
  kind: 'coach-link';
  token: string;
  trainerId: string;
  mode: CoachMode;
  /** the trainer's REQUEST; the client decides at accept time */
  request: Consent;
  targetUserId: string | null;
  displayName: string;
  createdAt: number;
  expiresAt: number;
  claimedAt: number | null;
  claimedBy: string | null;
  revokedAt: number | null;
}

export type InviteProblem = 'expired' | 'revoked' | 'claimed' | 'wrong-kind' | 'not-for-you';

export function inviteProblem(
  inv: Partial<CoachInviteDoc> | null | undefined,
  now: number,
  uid?: string,
): InviteProblem | null {
  if (!inv || inv.kind !== 'coach-link') return 'wrong-kind';
  if (inv.revokedAt) return 'revoked';
  if (inv.claimedAt) return 'claimed';
  if (typeof inv.expiresAt !== 'number' || inv.expiresAt <= now) return 'expired';
  if (uid && inv.targetUserId && inv.targetUserId !== uid) return 'not-for-you';
  return null;
}

export function cleanName(v: unknown, max = 80): string {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

export function parseConsent(raw: unknown, base: Consent): Consent {
  const out: Consent = { ...base };
  if (raw && typeof raw === 'object') {
    for (const c of CATEGORIES) {
      const v = (raw as Record<string, unknown>)[c];
      if (v !== undefined) {
        if (!LEVELS.includes(v as Level)) throw new Error(`bad-level:${c}`);
        out[c] = v as Level;
      }
    }
  }
  return out;
}

/** Program-only invites carry nothing to request (consent is forced off). */
export function effectiveRequest(mode: CoachMode, req: unknown): Consent {
  if (mode === 'program') return { ...ALL_OFF };
  return parseConsent(req, ALL_OFF);
}

/** The invite limits are counted from the trainer's own invites (no counter doc). */
export function inviteLimit(
  own: readonly Pick<CoachInviteDoc, 'createdAt' | 'claimedAt' | 'revokedAt' | 'expiresAt'>[],
  now: number,
): 'ok' | 'too-many-pending' | 'too-many-today' {
  const pending = own.filter((i) => !i.claimedAt && !i.revokedAt && i.expiresAt > now).length;
  if (pending >= MAX_PENDING_INVITES) return 'too-many-pending';
  if (own.filter((i) => i.createdAt > now - DAY).length >= MAX_INVITES_PER_DAY)
    return 'too-many-today';
  return 'ok';
}

/* ---- consent (R-BE-CON-1..3) -------------------------------------------------------------------------------- */
export interface ConsentChange {
  category: Category;
  from: Level;
  to: Level;
}
export function consentChanges(from: Consent, to: Consent): ConsentChange[] {
  return CATEGORIES.filter((c) => from[c] !== to[c]).map((c) => ({
    category: c,
    from: from[c],
    to: to[c],
  }));
}
const rank = (l: Level) => LEVELS.indexOf(l);
/** Categories whose shared evidence must go: a level went DOWN (to off: delete the share; effects: drop granular evidence). */
export function downgrades(ch: readonly ConsentChange[]): ConsentChange[] {
  return ch.filter((c) => rank(c.to) < rank(c.from));
}

export type ReadResult =
  | { state: 'locked' }
  | { state: 'not-applicable' }
  | { state: 'ok'; level: 'effects' | 'full'; asOf: number };

/** The ONLY consent cut on the server. Never returns a category above the stored level. */
export function gateCategory(
  c: Pick<CoachingDoc, 'status' | 'mode' | 'consent'>,
  cat: Category,
  now: number,
): ReadResult {
  if (c.status !== 'active') throw new Error('not-active');
  if (c.mode === 'program') return { state: 'not-applicable' };
  const l = c.consent[cat] ?? 'off';
  if (l === 'off') return { state: 'locked' };
  return { state: 'ok', level: l, asOf: now };
}

/* ---- audit (R-BE-AUD-1) ------------------------------------------------------------------------------------- */
export type ReadVia = 'client360' | 'queue' | 'brief' | 'export' | 'chat-share' | 'live' | 'view';
export const READ_VIA: readonly ReadVia[] = [
  'client360',
  'queue',
  'brief',
  'export',
  'chat-share',
  'live',
  'view',
];
export const dayKey = (at: number): string => new Date(at).toISOString().slice(0, 10);
/** One audit doc per (reader, subject, category, via, UTC day): repeated reads bump `count`. */
export const auditId = (
  reader: string,
  subject: string,
  cat: string,
  via: string,
  at: number,
): string => `r-${dayKey(at)}-${cat}-${via}-${reader}-${subject}`.slice(0, 300);
export const AUDIT_RETENTION = 400 * DAY;

/* ---- unread (plan 10) ---------------------------------------------------------------------------------------- */
export interface MsgOpen {
  from: string;
  at: number;
  deleted?: boolean;
  del?: { state: string };
}
export interface ConvPointers {
  clientId: string;
  trainerId: string;
  readUpTo?: Record<string, number>;
  clearedBefore?: Record<string, number>;
}
/** Unread for ONE side: the other party's messages after max(readUpTo, clearedBefore), not deleted / pending delete. */
export function unreadFor(uid: string, conv: ConvPointers, msgs: readonly MsgOpen[]): number {
  const floor = Math.max(conv.readUpTo?.[uid] ?? 0, conv.clearedBefore?.[uid] ?? 0);
  return msgs.filter(
    (m) => m.from !== uid && m.at > floor && !m.deleted && m.del?.state !== 'pending',
  ).length;
}
export function unreadMap(conv: ConvPointers, msgs: readonly MsgOpen[]): Record<string, number> {
  return {
    [conv.clientId]: unreadFor(conv.clientId, conv, msgs),
    [conv.trainerId]: unreadFor(conv.trainerId, conv, msgs),
  };
}

/* ---- reschedule requests (plan 11) --------------------------------------------------------------------------- */
export const MAX_REQUEST_TTL = 14 * DAY;
export type ReqStatus = 'pending' | 'accepted' | 'declined' | 'countered' | 'expired' | 'cancelled';
export interface RequestOpen {
  id: string;
  from: 'client' | 'trainer';
  status: ReqStatus;
  createdAt: number;
  expiresAt: number;
  slotKey: string;
  decidedAt?: number;
}
export function requestProblem(
  r: Pick<RequestOpen, 'createdAt' | 'expiresAt' | 'slotKey'>,
  now: number,
  existing: readonly Pick<RequestOpen, 'slotKey' | 'status'>[],
): 'bad-time' | 'ttl' | 'duplicate-slot' | 'bad-slot' | null {
  if (typeof r.slotKey !== 'string' || r.slotKey.length < 1 || r.slotKey.length > 64)
    return 'bad-slot';
  if (!Number.isInteger(r.createdAt) || Math.abs(r.createdAt - now) > 5 * 60_000) return 'bad-time';
  if (
    !Number.isInteger(r.expiresAt) ||
    r.expiresAt <= r.createdAt ||
    r.expiresAt > r.createdAt + MAX_REQUEST_TTL
  )
    return 'ttl';
  if (existing.some((e) => e.slotKey === r.slotKey && e.status === 'pending'))
    return 'duplicate-slot';
  return null;
}
/**
 * Only the OTHER party answers (accept, decline or counter: a counter marks this request `countered` and the answerer
 * creates a NEW request with `supersedes`), or the creator cancels; pending -> decided, never back.
 */
export function canDecide(
  r: Pick<RequestOpen, 'from' | 'status'>,
  actor: 'client' | 'trainer',
  to: ReqStatus,
): boolean {
  if (r.status !== 'pending') return false;
  if (to === 'cancelled') return actor === r.from;
  if (to === 'accepted' || to === 'declined' || to === 'countered') return actor !== r.from;
  return false;
}
export function expiredRequests<T extends Pick<RequestOpen, 'status' | 'expiresAt'>>(
  rs: readonly T[],
  now: number,
): T[] {
  return rs.filter((r) => r.status === 'pending' && r.expiresAt <= now);
}

/* ---- key epochs / rotation (C.2 no. 8) ----------------------------------------------------------------------- */
export const ROTATE_EVERY = 90 * DAY;
export const rotationDue = (lastRotatedAt: number, now: number): boolean =>
  now - lastRotatedAt >= ROTATE_EVERY;
/** Epochs only go forward by exactly one per rotation. */
export const nextEpoch = (cur: number): number => Math.max(1, Math.floor(cur)) + 1;

/* ---- message rate (C.3) -------------------------------------------------------------------------------------- */
export const MAX_MSGS_PER_MIN = 30;
export const UNDO_GRACE = 60_000;
export function rateLimited(
  recentAts: readonly number[],
  now: number,
  max = MAX_MSGS_PER_MIN,
): boolean {
  return recentAts.filter((a) => a > now - 60_000).length > max;
}

/* ---- log redaction (C.3) ------------------------------------------------------------------------------------ */
const SECRET_KEYS = new Set([
  'enc',
  'ct',
  'iv',
  'ck',
  'epk',
  'key',
  'salt',
  'text',
  'token',
  'sig',
  'pub',
  'priv',
  'body',
]);
/** Safe summary for logs: key names and sizes only, never the value of a string or of a sealed/secret field. */
export function redactForLog(x: unknown, depth = 0): unknown {
  if (x === null || typeof x !== 'object') return typeof x === 'string' ? `<str:${x.length}>` : x;
  if (depth > 3) return '<deep>';
  if (Array.isArray(x)) return `<array:${x.length}>`;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x))
    out[k] = SECRET_KEYS.has(k) ? '<redacted>' : redactForLog(v, depth + 1);
  return out;
}

/* ---- sealed envelope shape (mirror of firestore.rules `sealedCk`, used where only a function can write) --------- */
/** Plaintext cap of a chat-class envelope after base64: the rules accept `ct` shorter than 11000 characters. */
export const CK_CT_MIN = 100;
export const CK_CT_MAX = 11_000;
export const REQUEST_ID = /^[A-Za-z0-9_-]{1,80}$/;
export const MAX_PENDING_REQUESTS = 20;
/** `at` of a message may differ from server time by at most this much (rules enforce it with request.time). */
export const MAX_AT_SKEW = 2 * 60_000;

/** `{ v:1, iv, ct }` under the conversation key: nothing else, no plaintext sibling, bounded length. */
export function ckEnvelopeProblem(
  enc: unknown,
): 'not-sealed' | 'bad-envelope' | 'too-large' | null {
  if (typeof enc !== 'object' || enc === null || Array.isArray(enc)) return 'not-sealed';
  const e = enc as Record<string, unknown>;
  const keys = Object.keys(e);
  if (keys.some((k) => k !== 'v' && k !== 'iv' && k !== 'ct') || keys.length !== 3)
    return 'bad-envelope';
  if (e.v !== 1 || typeof e.iv !== 'string' || e.iv.length !== 16 || typeof e.ct !== 'string')
    return 'bad-envelope';
  if (e.ct.length < CK_CT_MIN) return 'bad-envelope';
  if (e.ct.length >= CK_CT_MAX) return 'too-large';
  return null;
}

/* ---- legacy callables: the same consent cut as coachRead -------------------------------------------------------- */
/**
 * Level a NON-self viewer may use for `cat`. Only the coach of record (trainerId on an ACTIVE coaching doc) ever gets
 * anything; an admin is a coach for the clients they coach themselves and has no other bypass (plan-security B-26).
 */
export function legacyLevel(
  c: Pick<CoachingDoc, 'status' | 'mode' | 'consent' | 'trainerId'> | null,
  viewerUid: string,
  cat: Category,
): Level {
  if (!c || c.trainerId !== viewerUid || c.status !== 'active' || c.mode === 'program')
    return 'off';
  return c.consent[cat] ?? 'off';
}
