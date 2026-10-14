/**
 * Automatic vault key.
 *
 * Every account's data key is derived on the server from a master secret that lives only
 * in Secret Manager (never in Firestore, never in the repo):
 *
 *   DEK  = HKDF-SHA256(master, salt = uid, info = "spotter.vault.dek.v<kv>")  — 32 bytes
 *   salt = HKDF-SHA256(master, salt = uid, info = "spotter.vault.salt.v<kv>")  — 16 bytes
 *
 * `kv` is the KEY VERSION. Version 1 is byte-identical to the original derivation, so existing ciphertext keeps opening;
 * a rotation bumps the deploy parameter VAULT_KV (and/or swaps the master) and clients re-seal in the background:
 * the callable returns the CURRENT version and, on request, any older one (`kv` in the request), which is exactly what a
 * client-driven re-wrap needs (see docs/COACH-SERVER-SECURITY.md "DEK rotation"). A bulk re-seal on the server is not
 * offered on purpose: it would need every sealed collection in plaintext on the server.
 *
 * A signed-in user receives only their own key, over TLS, through this callable. Nothing is stored except an
 * access log line (uid, version, count, day - never a key), so a database dump or a backup of Firestore contains only
 * ciphertext and is useless without the secret. Suspended accounts get no key. The master can be swapped for Cloud KMS
 * without touching clients: they only ever see `{ key, salt }`.
 *
 * Setup once:  firebase functions:secrets:set VAULT_MASTER   (paste 32+ random bytes, base64)
 */
import { hkdfSync } from 'node:crypto';
import { onCall } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { db, HttpsError, requireAuth } from './lib';
import { ENFORCE_APPCHECK } from './coach/runtime';
import { firestoreKv } from './coach/firestoreKv';
import type { Kv } from './coach/kv';

const VAULT_MASTER = defineSecret('VAULT_MASTER');
/** Current key version (integer >= 1). Bump at deploy to start a rotation; older versions stay derivable. */
const VAULT_KV = defineString('VAULT_KV', { default: '1' });

export const MAX_KEY_VERSION = 99;

/** Pure and deterministic: the same account and version always get the same key. */
export function vaultKeyFor(master: string, uid: string, kv = 1): { key: string; salt: string } {
  const ikm = Buffer.from(master, 'base64');
  if (ikm.length < 32) throw new Error('VAULT_MASTER must be at least 32 random bytes (base64).');
  if (!Number.isInteger(kv) || kv < 1 || kv > MAX_KEY_VERSION) throw new Error('bad key version');
  const derive = (info: string, len: number) =>
    Buffer.from(hkdfSync('sha256', ikm, Buffer.from(uid, 'utf8'), Buffer.from(info), len));
  return {
    key: derive(`spotter.vault.dek.v${kv}`, 32).toString('base64'),
    salt: derive(`spotter.vault.salt.v${kv}`, 16).toString('base64'),
  };
}

export interface VaultKeyResult {
  v: 1;
  /** version of the key in this response */
  kv: number;
  /** the version new data must be sealed with */
  current: number;
  key: string;
  salt: string;
}

const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);

/**
 * The whole behaviour of the callable on the Kv seam (unit tested): suspension check, version selection, access log.
 * The log line is written BEFORE the key is returned and a failure to write it fails the call (no unlogged key fetch).
 */
export async function vaultKeyHandler(
  kv: Kv,
  o: { uid: string; master: string; currentKv: number; requestedKv?: unknown; now: number },
): Promise<VaultKeyResult> {
  const user = await kv.get(`users/${o.uid}`);
  if (!user) throw new HttpsError('not-found', 'User not found.');
  if (user.status === 'suspended') throw new HttpsError('permission-denied', 'Account suspended.');
  const current = Math.min(Math.max(Math.floor(o.currentKv) || 1, 1), MAX_KEY_VERSION);
  let version = current;
  if (o.requestedKv !== undefined && o.requestedKv !== null) {
    const r = o.requestedKv;
    if (typeof r !== 'number' || !Number.isInteger(r) || r < 1 || r > current)
      throw new HttpsError('invalid-argument', 'Unknown key version.');
    version = r;
  }
  let material: { key: string; salt: string };
  try {
    material = vaultKeyFor(o.master, o.uid, version);
  } catch {
    // Misconfigured secret: fail closed, never fall back to an unencrypted or guessable key.
    throw new HttpsError('failed-precondition', 'Vault is not configured.');
  }
  const id = `${dayOf(o.now)}-kv${version}`;
  const path = `users/${o.uid}/keyLog/${id}`;
  await kv.tx(async (t) => {
    const cur = await t.get(path);
    if (cur) await t.merge(path, { count: Number(cur.count ?? 1) + 1, lastAt: o.now });
    else await t.set(path, { id, kv: version, current, count: 1, at: o.now, lastAt: o.now });
  });
  return { v: 1, kv: version, current, ...material };
}

export const vaultKey = onCall(
  { secrets: [VAULT_MASTER], enforceAppCheck: ENFORCE_APPCHECK },
  async (req) => {
    const uid = requireAuth(req);
    const requested = (req.data as { kv?: unknown } | undefined)?.kv;
    return vaultKeyHandler(firestoreKv(db), {
      uid,
      master: VAULT_MASTER.value(),
      currentKv: Number(VAULT_KV.value()),
      requestedKv: requested,
      now: Date.now(),
    });
  },
);
