/**
 * One on-device snapshot, sealed (stale-while-revalidate): the last good answer of a screen's data is stored with the
 * vault key in the sealed local store and read first on the next start; the network answer replaces it in the
 * background. Shared by the trainer's world and the client's link, so every screen follows one rule:
 *
 *   - nothing is stored in the clear; while the vault is locked the cache reads empty and writes nothing;
 *   - a snapshot of another account, another schema version, a wrong shape or past its age limit is ignored and dropped;
 *   - reading waits (bounded) for the vault key instead of failing, never throws, never blocks the screen.
 */
import type { SealedLocal } from './sealedLocal';

interface Stored<T> {
  v: number;
  uid: string;
  savedAt: number;
  value: T;
}

export interface SnapshotOpts<T> {
  /** the sealed-store key, e.g. `world:<uid>` */
  key: string;
  uid: string;
  /** bump when the shape of `T` changes: older snapshots are dropped */
  schema: number;
  /** a snapshot older than this is not shown any more */
  maxAgeMs: number;
  /** shape / ownership check on the decrypted value */
  accept: (value: T) => boolean;
  /** how long a read waits for the vault key (ms) */
  waitMs?: number;
  now?: () => number;
}

export interface SnapshotCache<T> {
  get(): Promise<{ value: T; savedAt: number } | null>;
  set(value: T, savedAt: number): Promise<void>;
}

/** Resolves when the store can be read (the vault key arrives) or after `ms`, whichever comes first. */
export function whenReady(local: SealedLocal, ms: number): Promise<boolean> {
  if (local.ready()) return Promise.resolve(true);
  return new Promise((res) => {
    let off: (() => void) | null = null;
    const done = (ok: boolean) => {
      clearTimeout(t);
      queueMicrotask(() => off?.());
      res(ok);
    };
    const t = setTimeout(() => done(local.ready()), ms);
    off = local.subscribe(() => {
      if (local.ready()) done(true);
    });
  });
}

export function snapshotOver<T>(local: Promise<SealedLocal>, o: SnapshotOpts<T>): SnapshotCache<T> {
  const now = o.now ?? (() => Date.now());
  const ok = (s: unknown): s is Stored<T> => {
    const x = s as Partial<Stored<T>> | null;
    return (
      !!x &&
      x.v === o.schema &&
      x.uid === o.uid &&
      typeof x.savedAt === 'number' &&
      now() - x.savedAt < o.maxAgeMs &&
      x.value !== undefined &&
      x.value !== null &&
      o.accept(x.value)
    );
  };
  return {
    async get() {
      try {
        const l = await local;
        if (!(await whenReady(l, o.waitMs ?? 10_000))) return null;
        const s = await l.get<Stored<T>>(o.key);
        if (!ok(s)) {
          if (s) await l.remove(o.key); // another schema / account / too old: drop it
          return null;
        }
        return { value: s.value, savedAt: s.savedAt };
      } catch {
        return null; // a cache must never break the screen
      }
    },
    async set(value, savedAt) {
      try {
        const l = await local;
        await l.set(o.key, { v: o.schema, uid: o.uid, savedAt, value } satisfies Stored<T>);
      } catch {
        /* best effort */
      }
    },
  };
}
