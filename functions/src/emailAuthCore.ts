/**
 * Email as one more way to sign in to an EXISTING account (SPO-283, SPO-224; plan docs/plans/SPO-224-283-423-dev-plan.md).
 * The password stays in our bcrypt store; this module only keeps the email → account index (`emails/{lower}`) and decides
 * who may use it. Pure over a `Kv` and two small ports, so it runs on the in-memory Kv in tests. Never logs or returns an
 * email other than the caller's own.
 */
import type { Kv } from './coach/kv';

export const EMAIL_MAX = 254;
/** Per account: how many link / change attempts in the window (the limiter itself lives in `auth.ts`). */
export const EMAIL_INDEX = 'emails';

export type AttachResult =
  { ok: true; email: string; verified: boolean } | { ok: false; reason: 'invalid' | 'taken' };

/** What the account's Firebase Auth record says (the source of truth for the verification). */
export interface AuthEmail {
  email: string | null;
  verified: boolean;
}

export interface AttachPorts {
  /** The account's current email and its verification state. */
  current(uid: string): Promise<AuthEmail>;
  /** Writes the email onto the account's Auth record, unverified. Throws `email-taken` if Auth knows it elsewhere. */
  setEmail(uid: string, email: string): Promise<void>;
}

/** trim + lower-case; `null` when it is not a plausible address (one `@`, a dotted domain, no spaces, ≤254). */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 5 || e.length > EMAIL_MAX) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(e)) return null;
  if (e.includes('..') || e.startsWith('.') || e.split('@')[0]!.endsWith('.')) return null;
  return e;
}

/**
 * New usernames never contain `@` (SPO-224): the sign-in field takes a username OR an email, and `@` in a username would
 * let someone hold another person's address as a name. Names that already have one keep working (kept as they are).
 */
export const usernameAllowed = (next: string, current?: string | null): boolean =>
  !next.includes('@') || (!!current && next.toLowerCase() === current.toLowerCase());

/** A sign-in identifier that is an email (usernames never contain `@`). */
export const looksLikeEmail = (identifier: string): boolean => identifier.includes('@');

interface IndexDoc {
  userId: string;
  verifiedAt: number | null;
  updatedAt: number;
  [k: string]: unknown;
}

const ref = (lower: string) => `${EMAIL_INDEX}/${encodeURIComponent(lower)}`;

/**
 * Links `rawEmail` to `uid`. A taken address is refused without saying whose it is. The same address again keeps its
 * verification; a different one resets it and frees the old index entry. The index entry is reserved in one transaction
 * first, then the Auth record is written; if Auth refuses, the reservation is rolled back.
 */
export async function attachEmail(
  kv: Kv,
  ports: AttachPorts,
  uid: string,
  rawEmail: unknown,
  now: number,
): Promise<AttachResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, reason: 'invalid' };
  const own = await ports.current(uid);
  if (own.email === email) {
    if (own.verified) await markVerified(kv, uid, email, now);
    return { ok: true, email, verified: own.verified };
  }
  let previous: IndexDoc | null = null;
  const taken = await kv.tx(async (t) => {
    const hit = (await t.get(ref(email))) as IndexDoc | null;
    if (hit && hit.userId !== uid) return true;
    const old = own.email ? ((await t.get(ref(own.email))) as IndexDoc | null) : null;
    await t.set(ref(email), { userId: uid, verifiedAt: null, updatedAt: now } satisfies IndexDoc);
    if (own.email && old && old.userId === uid) {
      previous = old;
      await t.del(ref(own.email));
    }
    return false;
  });
  if (taken) return { ok: false, reason: 'taken' };
  try {
    await ports.setEmail(uid, email);
  } catch (e) {
    const reason = e instanceof Error && e.message === 'email-taken' ? 'taken' : null;
    await kv.del(ref(email)).catch(() => undefined);
    // Put the old entry back exactly as it was (its confirmation included), so the old address keeps working.
    if (own.email && previous) await kv.set(ref(own.email), previous);
    if (reason) return { ok: false, reason };
    throw e;
  }
  return { ok: true, email, verified: false };
}

/** Records that the account's email is confirmed (the index is what sign-in reads). */
export async function markVerified(kv: Kv, uid: string, email: string, now: number): Promise<void> {
  const hit = (await kv.get(ref(email))) as IndexDoc | null;
  if (hit && hit.userId === uid && hit.verifiedAt === null) {
    await kv.set(ref(email), { ...hit, verifiedAt: now, updatedAt: now });
  } else if (!hit) {
    await kv.set(ref(email), { userId: uid, verifiedAt: now, updatedAt: now });
  }
}

/** The caller's email state; also syncs the index once Auth says it is confirmed. */
export async function emailStatus(
  kv: Kv,
  ports: Pick<AttachPorts, 'current'>,
  uid: string,
  now: number,
): Promise<AuthEmail> {
  const s = await ports.current(uid);
  if (s.email && s.verified) await markVerified(kv, uid, s.email, now);
  return s;
}

/**
 * Is a confirmed email required to use the app (`config/auth.requireVerifiedEmail`, SPO-423)? Off unless the owner
 * switched it on: the gate ships dark and is turned on after the deploy has been checked.
 */
export const isEmailRequired = (cfg: unknown): boolean =>
  !!cfg &&
  typeof cfg === 'object' &&
  (cfg as { requireVerifiedEmail?: unknown }).requireVerifiedEmail === true;

/**
 * The account an email signs in to: only when it is confirmed. Unknown, unconfirmed and any other case look the same to
 * the caller (the sign-in answer stays "wrong username or password").
 */
export async function emailLoginUser(kv: Kv, identifier: string): Promise<string | null> {
  const email = normalizeEmail(identifier);
  if (!email) return null;
  const hit = (await kv.get(ref(email))) as IndexDoc | null;
  return hit && hit.verifiedAt !== null ? hit.userId : null;
}

/** Minimum pause between two confirmation letters to the same address. */
export const CONFIRM_COOLDOWN_MS = 60_000;

/**
 * Takes the "one letter per minute" slot for this account's address in ONE transaction (parallel calls cannot both pass).
 * Returns false while the pause is running. Uses the address index entry, so no new collection or data appears.
 */
export async function claimConfirmSlot(
  kv: Kv,
  uid: string,
  email: string,
  now: number,
): Promise<boolean> {
  return kv.tx(async (t) => {
    const hit = (await t.get(ref(email))) as IndexDoc | null;
    if (!hit || hit.userId !== uid) return true;
    const last = typeof hit.mailedAt === 'number' ? hit.mailedAt : 0;
    if (now - last < CONFIRM_COOLDOWN_MS) return false;
    await t.set(ref(email), { ...hit, mailedAt: now });
    return true;
  });
}
