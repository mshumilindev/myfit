/**
 * Encryption of a program's planned activities (standing rule: user-entered data
 * is sealed with the account's vault key). Only the `activities` field moves into
 * an `activitiesEnc` envelope — name, days and lifting items stay readable, so the
 * server, trainer assignment and CSV work exactly as before.
 *
 * Writes require the account vault key; no plaintext fallback.
 * A sealed field that can't be opened (vault
 * locked / wrong key) is carried through untouched, never overwritten.
 */
import { deleteField } from 'firebase/firestore';
import { decryptJson, encryptJson, isEnvelope, type VaultEnvelope } from '../../vaultCrypto';
import { vault } from '../../vaultIO';
import type { Vault } from '../../autoVault';
import { sanitizeActivities, type ProgramActivity } from './model';

/** The doc fields to write for a planned-activities list (merge-safe: clears the other form). */
export async function activityFields(
  list: ProgramActivity[],
  v: Vault = vault,
): Promise<Record<string, unknown>> {
  const clean = sanitizeActivities(list);
  if (v.status() === 'ready') {
    const { key, salt } = v.material();
    return { activitiesEnc: await encryptJson(key, salt, clean), activities: deleteField() };
  }
  throw new Error('Vault key is not ready');
}

/** Full-document form (setDoc without merge): no deleteField sentinels. */
export async function sealActivitiesInDoc<
  T extends { activities?: ProgramActivity[]; activitiesEnc?: VaultEnvelope },
>(doc: T, v: Vault = vault): Promise<Record<string, unknown>> {
  const { activities, activitiesEnc, ...rest } = doc;
  if (activities === undefined) {
    // Nothing planned, or a sealed list we couldn't open: keep what is stored.
    return activitiesEnc ? { ...rest, activitiesEnc } : rest;
  }
  if (!activities.length) return rest;
  if (v.status() === 'ready') {
    const { key, salt } = v.material();
    return { ...rest, activitiesEnc: await encryptJson(key, salt, sanitizeActivities(activities)) };
  }
  throw new Error('Vault key is not ready');
}

/**
 * Reads a stored program: a sealed list is opened into `activities`; when it can't
 * be opened `activities` stays undefined and `activitiesEnc` marks it as locked.
 */
export async function openActivities<T extends { activities?: unknown; activitiesEnc?: unknown }>(
  p: T,
  v: Vault = vault,
): Promise<T> {
  if (!isEnvelope(p.activitiesEnc)) return p;
  const m = v.materialOrNull();
  if (!m) return { ...p, activities: undefined };
  try {
    const list = await decryptJson<unknown>(m.key, p.activitiesEnc);
    return { ...p, activities: sanitizeActivities(list) };
  } catch {
    return { ...p, activities: undefined };
  }
}

/** A sealed list this device can't read right now (editing it must not drop it). */
export const activitiesLocked = (p: { activities?: unknown; activitiesEnc?: unknown }): boolean =>
  p.activitiesEnc !== undefined && p.activities === undefined;
