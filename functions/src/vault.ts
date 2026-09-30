/**
 * Automatic vault key.
 *
 * Every account's data key is derived on the server from a master secret that lives only
 * in Secret Manager (never in Firestore, never in the repo):
 *
 *   DEK  = HKDF-SHA256(master, salt = uid, info = "spotter.vault.dek.v1")  — 32 bytes
 *   salt = HKDF-SHA256(master, salt = uid, info = "spotter.vault.salt.v1")  — 16 bytes
 *
 * A signed-in user receives only their own key, over TLS, through this callable. Nothing
 * is stored, so a database dump or a backup of Firestore contains only ciphertext and is
 * useless without the secret. The master can be swapped for Cloud KMS without touching
 * clients: they only ever see `{ key, salt }`.
 *
 * Setup once:  firebase functions:secrets:set VAULT_MASTER   (paste 32+ random bytes, base64)
 */
import { hkdfSync } from 'node:crypto';
import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, requireAuth } from './lib';

const VAULT_MASTER = defineSecret('VAULT_MASTER');

/** Pure and deterministic: the same account always gets the same key. */
export function vaultKeyFor(master: string, uid: string): { key: string; salt: string } {
  const ikm = Buffer.from(master, 'base64');
  if (ikm.length < 32) throw new Error('VAULT_MASTER must be at least 32 random bytes (base64).');
  const derive = (info: string, len: number) =>
    Buffer.from(hkdfSync('sha256', ikm, Buffer.from(uid, 'utf8'), Buffer.from(info), len));
  return {
    key: derive('spotter.vault.dek.v1', 32).toString('base64'),
    salt: derive('spotter.vault.salt.v1', 16).toString('base64'),
  };
}

export const vaultKey = onCall({ secrets: [VAULT_MASTER] }, (req) => {
  const uid = requireAuth(req);
  try {
    return { v: 1, ...vaultKeyFor(VAULT_MASTER.value(), uid) };
  } catch {
    // Misconfigured secret: fail closed, never fall back to an unencrypted or guessable key.
    throw new HttpsError('failed-precondition', 'Vault is not configured.');
  }
});
