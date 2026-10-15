/**
 * Offline-first reads for the Gym screens (stale-while-revalidate), over the sealed on-device store.
 *
 * It replaces the old plaintext `localStorage` read cache (`spotter.cache.*`). The rule for every screen:
 *
 *   1. paint the last good answer at once (from memory when this session already saw it, else from the sealed store);
 *   2. refresh from the network in the background, de-duplicated, and replace the snapshot;
 *   3. never block the screen on the network, never let a late snapshot overwrite data that arrived first.
 *
 * Storage rules (shared with the coach snapshots, see `snapshot.ts`):
 *   - nothing readable on disk: values are sealed with the vault key; while the vault is locked nothing is stored;
 *   - an entry of another account, another schema, a wrong shape or past its age limit is ignored and dropped;
 *   - reads wait a bounded time for the vault key and never throw; a cache failure is a miss, not an error;
 *   - wiped with the sealed store on sign-out / vault lock / 30 days idle, and on relationship end (`wipeOfflineEntries`).
 *
 * Because sealed storage is asynchronous there is no synchronous "peek" from disk. `peekNow` reads the in-memory copy
 * of this session only (instant on a remount); `peek` / `hydrate` / `revalidate` also read the disk.
 */
import { currentUid } from '../api';
import { purgeLegacyPlaintext } from '../deviceWipe';
import { getSealedLocal, type SealedLocal } from './sealedLocal';
import { snapshotOver, whenReady } from './snapshot';

/** Bump when the sealed envelope around a value changes; per-call `schema` covers the value's own shape. */
export const OFFLINE_SCHEMA = 1;
/** Older than this is not shown as "last known" any more. */
export const OFFLINE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
/** Sealed-store key prefix of every entry written here (relationship end drops all of them). */
export const OFFLINE_KEY_PREFIX = 'offline:';
/** How long a read waits for the vault key before it counts as a miss (the network answer is then the live one). */
export const PEEK_WAIT_MS = 1200;

export interface OfflineEntry<T> {
  /** when this answer was stored (ms) */
  at: number;
  data: T;
}

export interface OfflineSpec<T> {
  /** bump when the shape of `T` changes: older snapshots are dropped */
  schema?: number;
  maxAgeMs?: number;
  /** shape check on the decrypted value */
  accept?: (value: T) => boolean;
  /** how long a disk read waits for the vault key (ms) */
  waitMs?: number;
}

export interface RevalidateOpts<T> extends OfflineSpec<T> {
  key: string;
  /** the network read; its answer replaces the snapshot */
  fetch: () => Promise<T>;
  /** called with the snapshot first (`cache`), then with the network answer (`network`) */
  apply: (data: T, source: 'cache' | 'network', at: number) => void;
  /** a snapshot younger than this skips the network entirely (the old `cacheFresh` gate) */
  ttlMs?: number;
  /** true once the screen already has live data: a snapshot is then not applied */
  isLive?: () => boolean;
  onError?: (e: unknown) => void;
  /** in-flight de-duplication key; defaults to `key` (identical reads share one request) */
  dedupeKey?: string;
}

export interface OfflineDeps {
  local: () => Promise<SealedLocal>;
  uid: () => string | null;
  now?: () => number;
  waitMs?: number;
}

const settleNull = <T>(p: Promise<T | null>, ms: number): Promise<T | null> =>
  new Promise((res) => {
    const t = setTimeout(() => res(null), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        res(v);
      },
      () => {
        clearTimeout(t);
        res(null);
      },
    );
  });

export function createOfflineCache(deps: OfflineDeps) {
  const now = deps.now ?? (() => Date.now());
  const mem = new Map<string, OfflineEntry<unknown>>();
  const gens = new Map<string, number>();
  const inflight = new Map<string, Promise<unknown>>();
  const writes = new Map<string, Promise<void>>();

  const uidNow = (): string | null => {
    try {
      return deps.uid() || null;
    } catch {
      return null;
    }
  };
  const mk = (uid: string, key: string) => `${uid}|${key}`;
  const sk = (uid: string, key: string) => `${OFFLINE_KEY_PREFIX}${uid}:${key}`;
  const gen = (uid: string, key: string) => gens.get(mk(uid, key)) ?? 0;
  const maxAgeOf = (s?: { maxAgeMs?: number }) => s?.maxAgeMs ?? OFFLINE_MAX_AGE_MS;

  /** True when an entry exists and is younger than `maxAgeMs`. */
  function fresh(entry: { at: number } | null | undefined, maxAgeMs: number): boolean {
    return !!entry && now() - entry.at < maxAgeMs;
  }

  /** This session's in-memory copy only (never touches the disk): instant on a remount. */
  function peekNow<T>(key: string, spec?: { maxAgeMs?: number }): OfflineEntry<T> | null {
    const u = uidNow();
    const m = u ? mem.get(mk(u, key)) : undefined;
    return m && now() - m.at < maxAgeOf(spec) ? (m as OfflineEntry<T>) : null;
  }

  /** The last good answer: memory first, else the sealed store (bounded wait). Never throws. */
  async function peek<T>(key: string, spec: OfflineSpec<T> = {}): Promise<OfflineEntry<T> | null> {
    const u = uidNow();
    if (!u) return null;
    const hit = peekNow<T>(key, spec);
    if (hit) return hit;
    const waitMs = spec.waitMs ?? deps.waitMs ?? PEEK_WAIT_MS;
    const read = (async () => {
      const snap = snapshotOver<T>(deps.local(), {
        key: sk(u, key),
        uid: u,
        schema: spec.schema ?? OFFLINE_SCHEMA,
        maxAgeMs: maxAgeOf(spec),
        accept: spec.accept ?? (() => true),
        waitMs,
        now,
      });
      const s = await snap.get();
      return s ? ({ at: s.savedAt, data: s.value } satisfies OfflineEntry<T>) : null;
    })();
    // overall bound: a hung IndexedDB must not hang the screen either
    const e = await settleNull(read, waitMs + 2000);
    if (!e) return null;
    // an answer that landed while the disk was read wins over the older snapshot
    const newer = peekNow<T>(key, spec);
    if (newer) return newer;
    if (uidNow() !== u) return null; // the account changed meanwhile
    mem.set(mk(u, key), e);
    return e;
  }

  /** Keep `data`: in memory at once, sealed on disk when the vault is (or soon becomes) ready. Never throws. */
  function set<T>(key: string, data: T, spec: { schema?: number } = {}): Promise<void> {
    const u = uidNow();
    if (!u || data === undefined || data === null) return Promise.resolve();
    const at = now();
    mem.set(mk(u, key), { at, data });
    gens.set(mk(u, key), gen(u, key) + 1);
    const prev = writes.get(mk(u, key)) ?? Promise.resolve();
    const job = prev.then(async () => {
      try {
        const local = await deps.local();
        // first start: the vault key may arrive a moment after the first answer; a locked vault stores nothing
        if (!(await whenReady(local, deps.waitMs ?? 10_000))) return;
        const snap = snapshotOver<T>(deps.local(), {
          key: sk(u, key),
          uid: u,
          schema: spec.schema ?? OFFLINE_SCHEMA,
          maxAgeMs: OFFLINE_MAX_AGE_MS,
          accept: () => true,
          now,
        });
        await snap.set(data, at);
      } catch {
        /* best effort */
      }
    });
    writes.set(mk(u, key), job);
    void job.then(() => {
      if (writes.get(mk(u, key)) === job) writes.delete(mk(u, key));
    });
    return job;
  }

  async function remove(key: string): Promise<void> {
    const u = uidNow();
    if (!u) return;
    mem.delete(mk(u, key));
    gens.set(mk(u, key), gen(u, key) + 1);
    try {
      await (await deps.local()).remove(sk(u, key));
    } catch {
      /* nothing stored */
    }
  }

  /**
   * One network read per key at a time: identical reads started while one is in flight share it. `force` starts a
   * new request (after a mutation, so a stale in-flight answer is not reused).
   */
  function dedupe<T>(key: string, run: () => Promise<T>, o: { force?: boolean } = {}): Promise<T> {
    const k = mk(uidNow() ?? '', key);
    const cur = inflight.get(k);
    if (cur && !o.force) return cur as Promise<T>;
    const p = run().finally(() => {
      if (inflight.get(k) === p) inflight.delete(k);
    });
    inflight.set(k, p);
    return p;
  }

  /**
   * The network read that feeds a snapshot: identical reads in flight share one request (`force` starts a new one),
   * and the answer replaces the stored snapshot (memory at once, sealed when the vault is ready).
   */
  function load<T>(
    key: string,
    fetch: () => Promise<T>,
    o: { force?: boolean; dedupeKey?: string; schema?: number } = {},
  ): Promise<T> {
    return dedupe(
      o.dedupeKey ?? key,
      async () => {
        const d = await fetch();
        void set(key, d, o);
        return d;
      },
      o,
    );
  }

  /**
   * Seed a screen from the snapshot, only if no live data has arrived yet: not when `isLive()` says so, not when
   * the key was written (network answer, local edit) since the read began. Resolves whether it applied.
   */
  async function hydrate<T>(
    key: string,
    apply: (data: T, at: number) => void,
    spec: OfflineSpec<T> & { isLive?: () => boolean } = {},
  ): Promise<boolean> {
    const u = uidNow();
    if (!u) return false;
    const g0 = gen(u, key);
    const e = await peek<T>(key, spec);
    if (!e || uidNow() !== u || gen(u, key) !== g0 || spec.isLive?.()) return false;
    try {
      apply(e.data, e.at);
    } catch {
      return false;
    }
    return true;
  }

  /**
   * Stale-while-revalidate for one read: the snapshot first (if any, and the screen has nothing live), then the
   * network unless the snapshot is younger than `ttlMs`. Returns the cancel function (call on unmount).
   */
  function revalidate<T>(o: RevalidateOpts<T>): () => void {
    let alive = true;
    const u = uidNow();
    const g0 = u ? gen(u, o.key) : 0;
    void (async () => {
      const cached = await peek<T>(o.key, o);
      if (!alive) return;
      if (cached && u && gen(u, o.key) === g0 && !o.isLive?.()) {
        try {
          o.apply(cached.data, 'cache', cached.at);
        } catch {
          /* a broken consumer must not stop the refresh */
        }
      }
      if (cached && o.ttlMs !== undefined && fresh(cached, o.ttlMs)) return;
      try {
        const data = await load(o.key, o.fetch, o);
        if (alive) o.apply(data, 'network', now());
      } catch (e) {
        if (alive) o.onError?.(e);
      }
    })();
    return () => {
      alive = false;
    };
  }

  /** Forget this session's in-memory copies (sign-out / relationship end). */
  function clearMemory(): void {
    mem.clear();
    gens.clear();
  }

  /** Drop every sealed entry written here (relationship end), and the memory copies. */
  async function wipeEntries(): Promise<void> {
    clearMemory();
    try {
      const local = await deps.local();
      for (const k of await local.keys(OFFLINE_KEY_PREFIX)) await local.remove(k);
    } catch {
      /* nothing stored */
    }
  }

  return {
    peekNow,
    peek,
    set,
    remove,
    fresh,
    dedupe,
    load,
    hydrate,
    revalidate,
    clearMemory,
    wipeEntries,
  };
}

export type OfflineCache = ReturnType<typeof createOfflineCache>;

// --- the app-wide instance -------------------------------------------------------------------------------------

let shared: OfflineCache | null = null;

/** Test / story seam. Pass null to reset to the default. */
export function configureOffline(c: OfflineCache | null): void {
  shared = c;
}

function app(): OfflineCache {
  if (!shared) {
    purgeLegacyPlaintext(); // the old readable cache must not linger on a device that never reached the boot hook
    shared = createOfflineCache({ local: getSealedLocal, uid: currentUid });
  }
  return shared;
}

export const offlinePeekNow = <T>(key: string, spec?: { maxAgeMs?: number }) =>
  app().peekNow<T>(key, spec);
export const offlinePeek = <T>(key: string, spec?: OfflineSpec<T>) => app().peek<T>(key, spec);
export const offlineSet = <T>(key: string, data: T, spec?: { schema?: number }) =>
  app().set<T>(key, data, spec);
export const offlineRemove = (key: string) => app().remove(key);
export const offlineFresh = (entry: { at: number } | null | undefined, maxAgeMs: number) =>
  app().fresh(entry, maxAgeMs);
export const offlineDedupe = <T>(key: string, run: () => Promise<T>, o?: { force?: boolean }) =>
  app().dedupe<T>(key, run, o);
export const offlineLoad = <T>(
  key: string,
  fetch: () => Promise<T>,
  o?: { force?: boolean; dedupeKey?: string; schema?: number },
) => app().load<T>(key, fetch, o);
export const offlineHydrate = <T>(
  key: string,
  apply: (data: T, at: number) => void,
  spec?: OfflineSpec<T> & { isLive?: () => boolean },
) => app().hydrate<T>(key, apply, spec);
export const offlineRevalidate = <T>(o: RevalidateOpts<T>) => app().revalidate<T>(o);
export const wipeOfflineEntries = () => app().wipeEntries();
