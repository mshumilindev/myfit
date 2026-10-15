/**
 * The trainer's world, kept between launches (stale-while-revalidate): the last good snapshot is sealed with the vault
 * key and stored in the on-device sealed store, read first on the next start and replaced by the network answer in the
 * background. Nothing is ever stored in the clear: while the vault is locked the cache reads as empty and writes
 * nothing (see `sealedLocal.ts`). A snapshot of another account, another schema or an unreadable shape is ignored.
 */
import type { SealedLocal } from '../../chat/sealedLocal';
import type { WorldData } from '../port';
import type { WorldCache } from './worldPort';

/** Bump when the shape of `WorldData` changes in a way the old snapshot cannot be shown with. */
export const WORLD_SCHEMA = 1;
/** Older than this is not shown as "last known" any more (the sealed store sweeps entries idle for 30 days anyway). */
export const WORLD_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

interface Stored {
  v: number;
  uid: string;
  fetchedAt: number;
  data: WorldData;
}

const keyOf = (uid: string) => `world:${uid}`;

const valid = (s: unknown, uid: string, now: number): s is Stored => {
  const x = s as Partial<Stored> | null;
  return (
    !!x &&
    x.v === WORLD_SCHEMA &&
    x.uid === uid &&
    typeof x.fetchedAt === 'number' &&
    now - x.fetchedAt < WORLD_MAX_AGE_MS &&
    !!x.data &&
    Array.isArray(x.data.clients) &&
    x.data.trainer?.id === uid
  );
};

/** Resolves when the store can be read (the vault key arrives) or after `ms`, whichever comes first. */
function whenReady(local: SealedLocal, ms: number): Promise<boolean> {
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

export function worldCacheOver(
  local: Promise<SealedLocal>,
  uid: string,
  o: { waitMs?: number; now?: () => number } = {},
): WorldCache {
  const now = o.now ?? (() => Date.now());
  return {
    async get() {
      try {
        const l = await local;
        if (!(await whenReady(l, o.waitMs ?? 10_000))) return null;
        const s = await l.get<Stored>(keyOf(uid));
        if (!valid(s, uid, now())) {
          if (s) await l.remove(keyOf(uid)); // another schema / account / too old: drop it
          return null;
        }
        return { data: s.data, fetchedAt: s.fetchedAt };
      } catch {
        return null; // a cache must never break the screen
      }
    },
    async set(v) {
      try {
        const l = await local;
        await l.set(keyOf(uid), {
          v: WORLD_SCHEMA,
          uid,
          fetchedAt: v.fetchedAt,
          data: v.data,
        } satisfies Stored);
      } catch {
        /* best effort */
      }
    },
  };
}
