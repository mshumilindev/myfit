/**
 * Field-level sealing for documents that stay exactly where they always lived
 * (same Firestore collections, same ids). A sealed document keeps only the few
 * fields a server function or a query genuinely needs in the open; everything else
 * moves into one opaque `enc` envelope, so the database shows no readable values.
 *
 * Legacy (not yet migrated) documents have no `enc` and pass through unchanged, so
 * migration can run one collection at a time without a flag day.
 */
import { decryptJson, encryptJson, isEnvelope, type VaultEnvelope } from './vaultCrypto';

/**
 * Open fields per collection: what Cloud Functions or Firestore queries read.
 * Everything not listed here is encrypted. Change this table only together with
 * the function that needs the field (see docs/specs/chronic-conditions-plan.md §13).
 */
export const OPEN_FIELDS = {
  // users/{uid}/workouts — autoFinishStaleWorkouts queries finishedAt; aggregates read `stats`.
  workouts: ['id', 'startedAt', 'finishedAt', 'autoFinished', 'updatedAt', 'stats'],
  // users/{uid}/sleeps — endDueSleeps / startDueSleeps read these.
  sleeps: ['id', 'date', 'bedtime', 'wake', 'autoWakeAt', 'source', 'kind', 'updatedAt'],
  // users/{uid}/activities — history is ordered by startedAt.
  activities: ['id', 'startedAt', 'updatedAt'],
  // No server reads: everything inside.
  gyms: ['id', 'updatedAt'],
  restPeriods: ['id', 'updatedAt'],
  injuries: ['id', 'updatedAt'],
  conditions: ['id', 'updatedAt'],
  body: ['updatedAt'],
  // users/{uid}/meta/coachShare — what the athlete lets the coach see (coachView); the server
  // only forwards the ciphertext to the coach, whose grant opens it.
  coachShare: ['updatedAt'],
} as const satisfies Record<string, readonly string[]>;

export type SealedCollection = keyof typeof OPEN_FIELDS;

export interface Sealed {
  enc: VaultEnvelope;
  [openField: string]: unknown;
}

export const isSealed = (raw: unknown): raw is Sealed =>
  !!raw && typeof raw === 'object' && isEnvelope((raw as { enc?: unknown }).enc);

/** Split a document into its open fields and an encrypted remainder. */
export async function sealDoc<T extends Record<string, unknown>>(
  collection: SealedCollection,
  doc: T,
  key: CryptoKey,
  salt: string,
): Promise<Sealed> {
  const open = new Set<string>(OPEN_FIELDS[collection]);
  const out: Record<string, unknown> = {};
  const secret: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v === undefined) continue; // Firestore rejects undefined
    (open.has(k) ? out : secret)[k] = v;
  }
  out.enc = await encryptJson(key, salt, secret);
  return out as Sealed;
}

/** Inverse of `sealDoc`. Legacy documents (no `enc`) come back unchanged. */
export async function unsealDoc<T extends Record<string, unknown>>(
  raw: Record<string, unknown>,
  key: CryptoKey | null,
): Promise<T> {
  if (!isSealed(raw)) return raw as T;
  if (!key) throw new Error('vault-locked');
  const { enc, ...open } = raw;
  const secret = await decryptJson<Record<string, unknown>>(key, enc);
  return { ...open, ...secret } as T;
}
