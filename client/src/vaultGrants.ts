/**
 * Automatic key exchange. The only part of the vault the user never touches:
 *
 *  - a coach whose own vault is unlocked gets a key pair created and published on its own;
 *  - an athlete whose vault is unlocked and who has a coach gets a grant created for that
 *    coach on its own (and stale grants for former coaches removed).
 *
 * The vault key comes from the server automatically (autoVault.ts); nothing here needs a user action.
 * All I/O goes through ports so this is testable without Firebase.
 */
import type { Vault } from './autoVault';
import {
  createCoachKey,
  createGrant,
  isGrant,
  openGrant,
  type CoachKeyRecord,
  type Grant,
} from './vaultShare';

export type StoredGrant = Grant & {
  /** Fingerprint of the coach public key this grant was made for. */
  fp: string;
};

export interface GrantPorts {
  /** Coach's own record (private half encrypted), users/{me}/meta/coachKey. */
  loadOwnCoachKey(): Promise<CoachKeyRecord | null>;
  saveOwnCoachKey(rec: CoachKeyRecord): Promise<void>;
  /** Public half readable by athletes, coachKeys/{uid}. */
  publishCoachPub(pub: JsonWebKey): Promise<void>;
  loadCoachPub(coachId: string): Promise<JsonWebKey | null>;
  /** users/{me}/grants/* */
  loadGrant(coachId: string): Promise<StoredGrant | null>;
  saveGrant(coachId: string, g: StoredGrant): Promise<void>;
  listGrantIds(): Promise<string[]>;
  deleteGrant(coachId: string): Promise<void>;
}

export async function fingerprint(pub: JsonWebKey): Promise<string> {
  const data = new TextEncoder().encode(`${pub.crv}|${pub.x}|${pub.y}`);
  const h = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', data));
  return Array.from(h.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

export type CoachKeyResult = 'created' | 'present' | 'locked';

/** Coach side: make sure a key pair exists and its public half is published. */
export async function ensureCoachKey(vault: Vault, ports: GrantPorts): Promise<CoachKeyResult> {
  const m = vault.materialOrNull();
  if (!m) return 'locked';
  const existing = await ports.loadOwnCoachKey();
  if (existing) {
    await ports.publishCoachPub(existing.pub); // idempotent: heals a missing public doc
    return 'present';
  }
  const rec = await createCoachKey(m.key, m.salt);
  await ports.saveOwnCoachKey(rec);
  await ports.publishCoachPub(rec.pub);
  return 'created';
}

export type GrantResult = 'created' | 'current' | 'locked' | 'waiting-for-coach' | 'none';

/**
 * Athlete side: make sure the current coach (if any) holds a grant for this vault key,
 * and that no former coach still does. Safe to call on every start and on every coach change.
 */
export async function ensureGrant(
  vault: Vault,
  coachId: string | null,
  ports: GrantPorts,
): Promise<GrantResult> {
  const m = vault.materialOrNull();
  if (!m) return 'locked';
  for (const id of await ports.listGrantIds()) if (id !== coachId) await ports.deleteGrant(id);
  if (!coachId) return 'none';
  const pub = await ports.loadCoachPub(coachId);
  if (!pub) return 'waiting-for-coach'; // coach has not unlocked a vault yet; retry later
  const fp = await fingerprint(pub);
  const have = await ports.loadGrant(coachId);
  if (have && isGrant(have) && have.fp === fp && have.salt === m.salt) return 'current';
  await ports.saveGrant(coachId, { ...(await createGrant(m.key, m.salt, pub)), fp });
  return 'created';
}

/** Coach side: the athlete's key, or null when no grant exists yet (or this vault is locked). */
export async function openAthleteKey(
  vault: Vault,
  grant: unknown,
  ports: Pick<GrantPorts, 'loadOwnCoachKey'>,
): Promise<{ key: CryptoKey; salt: string } | null> {
  const m = vault.materialOrNull();
  if (!m || !isGrant(grant)) return null;
  const rec = await ports.loadOwnCoachKey();
  if (!rec) return null;
  try {
    return await openGrant(grant, rec, m.key);
  } catch {
    return null; // grant made for an older key pair: the athlete's device will refresh it
  }
}
