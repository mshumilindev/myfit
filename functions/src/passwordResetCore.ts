/**
 * Forgot-password (SPO-225), pure over a `Kv` and small ports so it runs on the in-memory Kv in tests.
 * A reset letter goes only to a CONFIRMED address of an ACTIVE account; every other case does nothing and looks the same
 * to the caller (no enumeration). The link is a one-time token of kind `reset` that lives one hour; opening it lets the
 * person set a new password through `claim`. The data key never depends on the password (`vaultKeyFor(master, uid, kv)`).
 */
import { createHash } from 'node:crypto';
import type { Kv } from './coach/kv';
import { claimConfirmSlot, emailLoginUser, normalizeEmail } from './emailAuthCore';

export const RESET_TTL_MS = 60 * 60 * 1000;
export const RESET_HOURS = RESET_TTL_MS / (60 * 60 * 1000);

export interface ResetPorts {
  /** The account's Firebase Auth email and its confirmation (null: no such record). */
  authRecord(uid: string): Promise<{ email: string | null; verified: boolean } | null>;
  /** `users/{uid}.status` (null: no such user). */
  userStatus(uid: string): Promise<'active' | 'invited' | 'suspended' | null>;
  /** Revokes the account's open reset links and stores a new one; returns its token. */
  issue(uid: string, now: number): Promise<string>;
  /** Sends the letter; false when the mailer refused or is not set up. */
  send(email: string, token: string): Promise<boolean>;
}

export type ResetOutcome = 'sent' | 'skipped' | 'failed';

/** Handles one request. `skipped`: nothing to do (unknown, unconfirmed, suspended, too soon); the caller answers the same. */
export async function requestReset(
  kv: Kv,
  ports: ResetPorts,
  rawEmail: unknown,
  now: number,
): Promise<ResetOutcome> {
  const email = normalizeEmail(rawEmail);
  if (!email) return 'skipped';
  const uid = await emailLoginUser(kv, email);
  if (!uid) return 'skipped';
  const [rec, status] = await Promise.all([ports.authRecord(uid), ports.userStatus(uid)]);
  if (!rec || rec.verified !== true || rec.email?.toLowerCase() !== email) return 'skipped';
  if (status !== 'active') return 'skipped';
  if (!(await claimConfirmSlot(kv, uid, email, now, 'resetAt'))) return 'skipped';
  const token = await ports.issue(uid, now);
  return (await ports.send(email, token)) ? 'sent' : 'failed';
}

/** Every request takes at least this long, so the time does not tell a known address from an unknown one. */
export const RESET_MIN_MS = 1500;

/**
 * The limiter id of an address: a hash, so the counters never hold the address a stranger typed (and a `/` or a long
 * address cannot break the document id). `accountDeletionCore` removes the one of the account's own addresses.
 */
export function resetLimiterId(rawEmail: string): string {
  const e = (normalizeEmail(rawEmail) ?? rawEmail.trim().toLowerCase()).slice(0, 254);
  return `reset:${createHash('sha256').update(e).digest('hex').slice(0, 16)}`;
}
