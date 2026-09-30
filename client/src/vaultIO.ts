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
import { createAutoVault } from './autoVault';
import { idbKeyCache, type Vault } from './vault';
import { callFn } from './api';
import { isFlagOn } from './data/flags';
import { migrateAll } from './vaultMigrate';
import { sealDoc, unsealDoc, isSealed, type SealedCollection } from './encryptedDoc';
import { ensureCoachKey, ensureGrant, type GrantPorts, type StoredGrant } from './vaultGrants';
import type { CoachKeyRecord } from './vaultShare';

let uidNow: string | null = null;

// The key is handed out by the server for the signed-in account: no key to save or type.
// The per-account IndexedDB cache keeps a non-extractable copy for offline starts.
export const vault: Vault = createAutoVault({
  fetchKey: () => callFn<{ key: string; salt: string }>('vaultKey', {}, { quiet: true }),
  cache: {
    get: () => idbKeyCache('spotter.vault', uidNow ?? 'anon').get(),
    set: (v) => idbKeyCache('spotter.vault', uidNow ?? 'anon').set(v),
    clear: () => idbKeyCache('spotter.vault', uidNow ?? 'anon').clear(),
  },
});

let enrichWorkout: (d: Record<string, unknown>) => Record<string, unknown> = (d) => d;
/** The store registers how a workout gets its readable `stats` (avoids an import cycle). */
export function setMigrationEnricher(f: typeof enrichWorkout): void {
  enrichWorkout = f;
}

const migratedKey = (uid: string) => `spotter.vault.migrated.${uid}`;
let migrating = false;

/** Seals existing plaintext once per account; idempotent, and a failure just retries next start. */
async function autoMigrate(): Promise<void> {
  const uid = uidNow;
  if (!uid || migrating || vault.status() !== 'ready') return;
  try {
    if (localStorage.getItem(migratedKey(uid))) return;
  } catch {
    /* storage unavailable: migrate anyway, it is idempotent */
  }
  migrating = true;
  try {
    const { ok } = await migrateAll(vault, migratePorts(enrichWorkout));
    if (ok && uidNow === uid) {
      try {
        localStorage.setItem(migratedKey(uid), '1');
      } catch {
        /* fine */
      }
    }
  } catch {
    /* offline or rules not deployed: next start retries */
  } finally {
    migrating = false;
  }
}

/** Call after sign-in (and on sign-out with null). Off unless the feature flag is on. */
export async function initVault(uid: string | null): Promise<void> {
  if (!uid) {
    uidNow = null;
    await vault.lock();
    return;
  }
  uidNow = uid;
  if (!isFlagOn('conditions')) return;
  await vault.init();
  // Let the first sync settle before rewriting documents in place.
  setTimeout(() => void autoMigrate(), 8000);
}

if (typeof window !== 'undefined') {
  // Came back online / returned to the tab without a key: ask again.
  const retry = () => {
    if (uidNow && isFlagOn('conditions') && vault.status() !== 'ready') void vault.init();
  };
  window.addEventListener('online', retry);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') retry();
  });
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
      if (c === 'body' || c === 'coachShare') {
        const s = await getDoc(doc(db, 'users', uid(), 'meta', c));
        return s.exists() ? [{ id: c, data: s.data() }] : [];
      }
      const snap = await getDocs(collection(db, 'users', uid(), c));
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
    async write(c, id, data) {
      const ref =
        c === 'body' || c === 'coachShare'
          ? doc(db, 'users', uid(), 'meta', c)
          : doc(db, 'users', uid(), c, id);
      await setDoc(ref, data);
    },
    enrich: (c, d) => (c === 'workouts' ? enrichWorkout(d) : d),
  };
}
