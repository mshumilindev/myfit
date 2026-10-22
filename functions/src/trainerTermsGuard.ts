/**
 * Trainer Terms + DPA enforced on the SERVER (SPO-289, owner decision 22.10.2026: strict, no grace period).
 *
 * `requireTrainerTerms(uid, role)` is called by every callable that reads or writes a client's data, the client roster or
 * the coaching relationship from the trainer's side. It lets members through untouched and refuses a trainer, manager
 * or admin who has no CURRENT acceptance with `failed-precondition` and the stable machine code `trainer-terms-required`
 * (HttpsError `details.reason`, also the message), which the client maps to re-opening the Trainer Terms sheet.
 *
 * "Accepted" mirrors client `useTrainerTermsNeeded` / `hasCurrentConsent`: the caller's LATEST `trainer-terms` record
 * (by `at`, then id) is a grant, at the current released version, carrying a well-formed `textHash`.
 * One indexed-by-default read (`kind ==`, no composite index; the few records of ONE kind are read and the newest picked).
 * Only a positive answer is cached per instance (short TTL); a refusal is never cached, so accepting works at once.
 *
 * NOT guarded on purpose: members, the client side of any call, `recordConsent`, auth/login, account deletion, admin
 * account and maintenance functions that touch no client data, and every scheduled / background job (reminders, sweeps,
 * push, triggers): those are Spotter acting, not a trainer using client data. The full table is in
 * docs/plans/SPO-295-dev-plan.md section 13; `tests/trainerTermsGuard.coverage.test.ts` fails when a callable is in neither list.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { Kv } from './coach/kv';
import { currentVersionOf } from './consentRecordsPure';

export const TRAINER_TERMS_REQUIRED = 'trainer-terms-required';
/** Roles that act as the trainer side of coaching (the same set as the client's `canUseCoach`). */
export const TRAINER_TERMS_ROLES: readonly string[] = ['trainer', 'manager', 'admin'];
/** A positive answer is trusted this long per instance; a withdrawal then bites within this window. */
export const ACCEPTED_CACHE_MS = 10_000;

const HASH_RE = /^[0-9a-f]{64}$/;
const accepted = new Map<string, number>();

/** Tests only. */
export function resetTrainerTermsCache(): void {
  accepted.clear();
}

interface RecordLike {
  id?: unknown;
  at?: unknown;
  action?: unknown;
  version?: unknown;
  textHash?: unknown;
}

/** The newest record wins (`at`, then id): a later withdrawal or an older-version grant after it is not acceptance. */
export function isTrainerTermsAccepted(
  rows: readonly { data: Record<string, unknown> }[],
): boolean {
  let best: RecordLike | null = null;
  for (const r of rows) {
    const d = r.data as RecordLike;
    if (typeof d.at !== 'number') continue;
    if (!best || d.at > (best.at as number) || (d.at === best.at && String(d.id) > String(best.id)))
      best = d;
  }
  return (
    !!best &&
    best.action === 'grant' &&
    best.version === currentVersionOf('trainer-terms') &&
    typeof best.textHash === 'string' &&
    HASH_RE.test(best.textHash)
  );
}

export async function requireTrainerTermsKv(
  kv: Kv,
  uid: string,
  role: string,
  now: number = Date.now(),
): Promise<void> {
  if (!TRAINER_TERMS_ROLES.includes(role)) return;
  const hit = accepted.get(uid);
  if (hit !== undefined && now - hit < ACCEPTED_CACHE_MS) return;
  const rows = await kv.list(`users/${uid}/consentRecords`, {
    where: [['kind', '==', 'trainer-terms']],
  });
  if (!isTrainerTermsAccepted(rows)) {
    accepted.delete(uid);
    throw new HttpsError('failed-precondition', TRAINER_TERMS_REQUIRED, {
      reason: TRAINER_TERMS_REQUIRED,
    });
  }
  accepted.set(uid, now);
}

/** The production entry point: binds the Firestore Kv. */
export async function requireTrainerTerms(uid: string, role: string): Promise<void> {
  if (!TRAINER_TERMS_ROLES.includes(role)) return;
  const { coachKv } = await import('./coach/runtime');
  return requireTrainerTermsKv(coachKv, uid, role);
}
