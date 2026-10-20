/**
 * Shared fixture of the adapter tests: one memory store, a server signing key, a signed coach key, a seeded
 * conversation and a trainer + client vault. Not imported by the app.
 */
import { b64 } from '../../../vaultCrypto';
import { fingerprint } from '../../../vaultGrants';
import { createCoachKey, type CoachKeyRecord } from '../../../vaultShare';
import { readyVault } from '../../../testVault';
import type { Vault } from '../../../autoVault';
import { createRingProvider, type RingProvider } from './keyRing';
import type { FsApi } from './fsApi';
import { createMemoryFs, type MemoryFs } from './memoryFs';
import { createRingBook, type RingBook } from './ringBook';
import { coachKeySigPayload, createServerSigningLoader } from './trust';

export const CID = 'abcdefghijklmnopqrstuvwxyz';
export const T = 'trainer-1';
export const C = 'client-1';
export const NOW = 1_800_000_000_000;

export interface TestWorld {
  fs: MemoryFs;
  tv: Vault;
  cv: Vault;
  rec: CoachKeyRecord;
  trainerRings: RingProvider;
  clientRings: RingProvider;
  /** the trainer's / client's view of the store (the raw store unless a `wrap` was given) */
  tfs: FsApi;
  cfs: FsApi;
  trainerBook: RingBook;
  clientBook: RingBook;
  /** the client device creates and publishes the conversation key */
  publishKey(): Promise<void>;
  /** a fresh trainer ring provider (empty cache, as after a restart) reading with `rec` (default: the current coach key) */
  trainerProvider(rec?: CoachKeyRecord): RingProvider;
  /** the coach publishes a NEW key pair, signed by the server key; returns the new record */
  rotateCoachKey(): Promise<CoachKeyRecord>;
  /** publish another account's public key (a team manager) at `coachKeys/{uid}`, signed by the server key or not */
  publishPeerKey(uid: string, pub: JsonWebKey, signed?: boolean): Promise<void>;
}

/** Wraps the store for one signed-in side (the rules test layer enforces `firestore.rules` through it). */
export type FsWrap = (fs: MemoryFs, uid: string, role: 'member' | 'trainer') => FsApi;

export async function makeWorld(wrap?: FsWrap): Promise<TestWorld> {
  const fs = createMemoryFs(NOW);
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  fs.seed('config/coachSigning', {
    alg: 'Ed25519',
    kid: 'srv1',
    pub: `-----BEGIN PUBLIC KEY-----\n${b64(spki)}\n-----END PUBLIC KEY-----`,
  });
  const tv = await readyVault();
  const cv = await readyVault();
  const m = tv.materialOrNull()!;
  const rec = await createCoachKey(m.key, m.salt);
  const sig = b64(
    new Uint8Array(
      await crypto.subtle.sign(
        { name: 'Ed25519' },
        pair.privateKey,
        new TextEncoder().encode(coachKeySigPayload(T, await fingerprint(rec.pub), NOW, 'srv1')),
      ),
    ),
  );
  fs.seed(`coachKeys/${T}`, { pub: rec.pub, updatedAt: NOW, kid: 'srv1', sig, signedAt: NOW });
  fs.seed(`conversations/${CID}`, {
    clientId: C,
    trainerId: T,
    active: true,
    keyEpoch: 0,
    lastAt: null,
    unread: {},
  });
  fs.seed(`coaching/${C}`, { keyEpoch: 1, trainerId: T, status: 'active' });
  const signing = createServerSigningLoader(fs);
  const tfs = wrap ? wrap(fs, T, 'trainer') : fs;
  const cfs = wrap ? wrap(fs, C, 'member') : fs;
  const trainerRings = createRingProvider({
    fs: tfs,
    vault: tv,
    uid: T,
    side: 'trainer',
    signing,
    loadOwnCoachKey: async () => rec,
  });
  const clientRings = createRingProvider({ fs: cfs, vault: cv, uid: C, side: 'client', signing });
  const trainerBook = createRingBook({ fs: tfs, rings: trainerRings, uid: T, side: 'trainer' });
  const clientBook = createRingBook({ fs: cfs, rings: clientRings, uid: C, side: 'client' });
  let currentRec = rec;
  const trainerProvider = (r: CoachKeyRecord = currentRec) =>
    createRingProvider({
      fs: tfs,
      vault: tv,
      uid: T,
      side: 'trainer',
      signing,
      loadOwnCoachKey: async () => r,
    });
  return {
    trainerProvider,
    async rotateCoachKey() {
      const next = await createCoachKey(m.key, m.salt);
      const at = NOW + 1000;
      const nsig = b64(
        new Uint8Array(
          await crypto.subtle.sign(
            { name: 'Ed25519' },
            pair.privateKey,
            new TextEncoder().encode(
              coachKeySigPayload(T, await fingerprint(next.pub), at, 'srv1'),
            ),
          ),
        ),
      );
      fs.seed(`coachKeys/${T}`, {
        pub: next.pub,
        updatedAt: at,
        kid: 'srv1',
        sig: nsig,
        signedAt: at,
      });
      currentRec = next;
      return next;
    },
    async publishPeerKey(uid, pub, signed = true) {
      const base = { pub, updatedAt: NOW };
      if (!signed) return fs.seed(`coachKeys/${uid}`, base);
      const sig = b64(
        new Uint8Array(
          await crypto.subtle.sign(
            { name: 'Ed25519' },
            pair.privateKey,
            new TextEncoder().encode(coachKeySigPayload(uid, await fingerprint(pub), NOW, 'srv1')),
          ),
        ),
      );
      fs.seed(`coachKeys/${uid}`, { ...base, kid: 'srv1', sig, signedAt: NOW });
    },
    fs,
    tfs,
    cfs,
    tv,
    cv,
    rec,
    trainerRings,
    clientRings,
    trainerBook,
    clientBook,
    async publishKey() {
      await clientRings.current(CID);
    },
  };
}
