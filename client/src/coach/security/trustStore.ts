/**
 * What this device remembers about a trainer's security code, per conversation (plan Part C.2 no. 5):
 *   seen      the code last shown (a different one later = "the security code changed")
 *   verified  the code the person confirmed out loud (null = never)
 *   pending   a change was noticed and not acknowledged yet (drives the chat banner and the one-time toast)
 *
 * The record is a user decision, so it is SEALED on the device (sealed local store, key `trust:<cid>`, wiped with the
 * conversation on relationship end and on sign-out) and never touches localStorage. With no sealed store (tests, a
 * locked vault) it lives in memory only. The reducer functions are pure.
 */
import { isLocalConfigured, getSealedLocal, type SealedLocal } from '../chat/sealedLocal';

export interface TrustRecord {
  seen: string;
  verified: string | null;
  pending: boolean;
}

export type Observed = { rec: TrustRecord; changed: boolean };

/** A code arrived. The first one ever is just remembered; a different one later raises `pending`. */
export function observe(rec: TrustRecord | null, code: string): Observed {
  if (!rec) return { rec: { seen: code, verified: null, pending: false }, changed: false };
  if (rec.seen === code) return { rec, changed: false };
  return { rec: { ...rec, seen: code, pending: true }, changed: true };
}
export const verify = (rec: TrustRecord): TrustRecord => ({
  ...rec,
  verified: rec.seen,
  pending: false,
});
export const unverify = (rec: TrustRecord): TrustRecord => ({ ...rec, verified: null });
export const acknowledge = (rec: TrustRecord): TrustRecord => ({ ...rec, pending: false });
/** Verified means: the person confirmed THIS code, not an earlier one. */
export const isVerified = (rec: TrustRecord | null): boolean => !!rec && rec.verified === rec.seen;

const key = (cid: string) => `trust:${cid}`;
const isRecord = (x: unknown): x is TrustRecord =>
  !!x &&
  typeof x === 'object' &&
  typeof (x as TrustRecord).seen === 'string' &&
  typeof (x as TrustRecord).pending === 'boolean' &&
  ((x as TrustRecord).verified === null || typeof (x as TrustRecord).verified === 'string');

export interface TrustStore {
  load(cid: string): Promise<TrustRecord | null>;
  save(cid: string, rec: TrustRecord): Promise<void>;
  forget(cid: string): Promise<void>;
}

/** Memory only (tests, locked vault). */
export function createMemoryTrustStore(): TrustStore {
  const m = new Map<string, TrustRecord>();
  return {
    load: async (cid) => m.get(cid) ?? null,
    save: async (cid, r) => void m.set(cid, r),
    forget: async (cid) => void m.delete(cid),
  };
}

/** Sealed on the device; falls back to memory for what the sealed store refused (vault locked). */
export function createSealedTrustStore(local: () => Promise<SealedLocal>): TrustStore {
  const mem = createMemoryTrustStore();
  return {
    async load(cid) {
      try {
        const v = await (await local()).get<unknown>(key(cid));
        if (isRecord(v)) return v;
      } catch {
        /* locked or no storage: memory */
      }
      return mem.load(cid);
    },
    async save(cid, rec) {
      await mem.save(cid, rec);
      try {
        await (await local()).set(key(cid), rec);
      } catch {
        /* memory only */
      }
    },
    async forget(cid) {
      await mem.forget(cid);
      try {
        await (await local()).remove(key(cid));
      } catch {
        /* nothing stored */
      }
    },
  };
}

let shared: TrustStore | null = null;
export function configureTrustStore(s: TrustStore | null): void {
  shared = s;
}
/** The app store: sealed when IndexedDB exists (or a sealed store was configured), memory otherwise. */
export function trustStore(): TrustStore {
  if (shared) return shared;
  const has = typeof indexedDB !== 'undefined' || isLocalConfigured();
  return (shared = has ? createSealedTrustStore(getSealedLocal) : createMemoryTrustStore());
}
