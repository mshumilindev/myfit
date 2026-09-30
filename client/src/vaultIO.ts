/**
 * Glue between the vault and Firestore reads/writes. Documents stay in their
 * original collections; this only transforms them on the way in and out.
 *
 * Write rules (by vault status):
 *  - unknown / unset → plaintext, exactly as before (feature off or not set up yet)
 *  - ready           → sealed
 *  - locked          → refuse: writing plaintext would downgrade encrypted data
 */
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import type { MigratePorts } from './vaultMigrate';
import { db } from './firebase';
import { createVault, idbKeyCache, type Vault, type VaultHeader } from './vault';
import { sealDoc, unsealDoc, isSealed, type SealedCollection } from './encryptedDoc';
import { isEnvelope } from './vaultCrypto';
import { ensureCoachKey, ensureGrant, type GrantPorts, type StoredGrant } from './vaultGrants';
import type { CoachKeyRecord } from './vaultShare';

let uidNow: string | null = null;

export const vault: Vault = createVault({
  remote: {
    async load() {
      if (!uidNow) return null;
      const s = await getDoc(doc(db, 'users', uidNow, 'meta', 'vault'));
      const d = s.exists() ? (s.data() as Partial<VaultHeader>) : null;
      return d && typeof d.salt === 'string' && isEnvelope(d.check) ? (d as VaultHeader) : null;
    },
    async save(h) {
      if (!uidNow) throw new Error('not signed in');
      await setDoc(doc(db, 'users', uidNow, 'meta', 'vault'), h);
    },
  },
  // Cache is keyed per account so a shared browser never reuses another user's key.
  cache: {
    get: () => idbKeyCache('spotter.vault', uidNow ?? 'anon').get(),
    set: (v) => idbKeyCache('spotter.vault', uidNow ?? 'anon').set(v),
    clear: () => idbKeyCache('spotter.vault', uidNow ?? 'anon').clear(),
  },
});

/** Call after sign-in (and on sign-out with null). */
export async function initVault(uid: string | null): Promise<void> {
  uidNow = uid;
  if (!uid) return;
  await vault.init();
}

/** What to store for `data`. Plaintext until the vault is set up. */
export async function prepareWrite<T extends Record<string, unknown>>(
  collection: SealedCollection,
  data: T,
  v: Vault = vault,
): Promise<Record<string, unknown>> {
  const st = v.status();
  if (st === 'locked') throw new Error('vault-locked');
  if (st !== 'ready') return data;
  const { key, salt } = v.material();
  return sealDoc(collection, data, key, salt);
}

/**
 * Turns raw snapshot documents into plain objects. While the vault is locked, sealed
 * documents are skipped (the UI asks for the recovery key) and plaintext ones still show.
 */
export async function readDocs<T extends Record<string, unknown>>(
  raws: Record<string, unknown>[],
  v: Vault = vault,
): Promise<{ items: T[]; locked: number }> {
  const m = v.materialOrNull();
  const items: T[] = [];
  let locked = 0;
  for (const raw of raws) {
    if (isSealed(raw) && !m) {
      locked++;
      continue;
    }
    try {
      items.push(await unsealDoc<T>(raw, m?.key ?? null));
    } catch {
      locked++; // wrong key / corrupted: treat as unreadable, never crash the listener
    }
  }
  return { items, locked };
}

/**
 * A snapshot handler for one collection. Keeps the last raw snapshot so documents that
 * were skipped while locked appear the moment the vault unlocks, and drops results of
 * older snapshots that finish decrypting after a newer one.
 */
export function mirrorCollection<T extends Record<string, unknown>, M = undefined>(
  apply: (items: T[], info: { locked: number; meta: M }) => void,
  v: Vault = vault,
): { push(raws: Record<string, unknown>[], meta?: M): void; dispose(): void } {
  let last: Record<string, unknown>[] | null = null;
  let lastMeta: M | undefined;
  let seq = 0;
  const run = async () => {
    if (!last) return;
    const my = ++seq;
    const { items, locked } = await readDocs<T>(last, v);
    if (my === seq) apply(items, { locked, meta: lastMeta as M });
  };
  const off = v.subscribe(() => void run());
  return {
    push(raws, meta) {
      last = raws;
      lastMeta = meta;
      void run();
    },
    dispose: off,
  };
}

// --- Automatic key exchange ---------------------------------------------------

const grantPorts = (uid: string): GrantPorts => ({
  async loadOwnCoachKey() {
    const s = await getDoc(doc(db, 'users', uid, 'meta', 'coachKey'));
    return s.exists() ? (s.data() as CoachKeyRecord) : null;
  },
  saveOwnCoachKey: (rec) => setDoc(doc(db, 'users', uid, 'meta', 'coachKey'), rec),
  publishCoachPub: (pub) => setDoc(doc(db, 'coachKeys', uid), { pub, updatedAt: Date.now() }),
  async loadCoachPub(coachId) {
    const s = await getDoc(doc(db, 'coachKeys', coachId));
    return s.exists() ? ((s.data() as { pub?: JsonWebKey }).pub ?? null) : null;
  },
  async loadGrant(coachId) {
    const s = await getDoc(doc(db, 'users', uid, 'grants', coachId));
    return s.exists() ? (s.data() as StoredGrant) : null;
  },
  saveGrant: (coachId, g) => setDoc(doc(db, 'users', uid, 'grants', coachId), g),
  async listGrantIds() {
    return (await getDocs(collection(db, 'users', uid, 'grants'))).docs.map((d) => d.id);
  },
  deleteGrant: (coachId) => deleteDoc(doc(db, 'users', uid, 'grants', coachId)),
});

let exchangeArgs: { trainerId: string | null; isCoach: boolean } | null = null;
let exchangeRunning = false;

/**
 * Hands keys over without any user action: publishes a coach's public key and grants the
 * athlete's key to their current coach. Runs whenever the coach assignment changes and
 * whenever the vault becomes ready; failures are silent and retried on the next trigger.
 */
export async function runKeyExchange(trainerId: string | null, isCoach: boolean): Promise<void> {
  exchangeArgs = { trainerId, isCoach };
  if (!uidNow || vault.status() !== 'ready' || exchangeRunning) return;
  exchangeRunning = true;
  try {
    const ports = grantPorts(uidNow);
    if (isCoach) await ensureCoachKey(vault, ports);
    await ensureGrant(vault, trainerId, ports);
  } catch {
    /* offline or rules not deployed yet: next trigger retries */
  } finally {
    exchangeRunning = false;
  }
}

vault.subscribe(() => {
  if (vault.status() === 'ready' && exchangeArgs)
    void runKeyExchange(exchangeArgs.trainerId, exchangeArgs.isCoach);
});

/** The signed-in coach's own (encrypted) key record, for opening athlete grants. */
export const loadOwnCoachKey = async (): Promise<CoachKeyRecord | null> =>
  uidNow ? grantPorts(uidNow).loadOwnCoachKey() : null;

/**
 * Firestore ports for the one-time migration. `enrichWorkout` adds the readable `stats`
 * (passed in to keep this file free of a store import).
 */
export function migratePorts(
  enrichWorkout: (d: Record<string, unknown>) => Record<string, unknown>,
): MigratePorts {
  const uid = () => {
    if (!uidNow) throw new Error('not signed in');
    return uidNow;
  };
  return {
    async list(c) {
      if (c === 'body') {
        const s = await getDoc(doc(db, 'users', uid(), 'meta', 'body'));
        return s.exists() ? [{ id: 'body', data: s.data() }] : [];
      }
      const snap = await getDocs(collection(db, 'users', uid(), c));
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
    async write(c, id, data) {
      const ref =
        c === 'body' ? doc(db, 'users', uid(), 'meta', 'body') : doc(db, 'users', uid(), c, id);
      await setDoc(ref, data);
    },
    enrich: (c, d) => (c === 'workouts' ? enrichWorkout(d) : d),
  };
}
