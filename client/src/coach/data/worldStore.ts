/**
 * Framework-free store behind `useCoachWorld`. Rules (user requirement, never blocking):
 *  - `start()` returns immediately; it paints the cached snapshot (`stale`) and refreshes in the background;
 *  - no cache + no answer yet = `loading` (the UI draws skeletons, never a full-screen overlay);
 *  - a failed refresh with data keeps the data: `offline` when the device is offline, else `stale` with `error`;
 *  - `error` exists only when there is nothing to show; `retry()` is the quiet action;
 *  - writes are optimistic, queued as serialisable ops, retried on every refresh (offline-safe, idempotent ids).
 */
import { emptyBook, type DecisionBook } from '../domain/decisions';
import { measureDecision } from '../domain/outcome';
import { applyOp, type BookOp } from './bookOps';
import { rememberPhotoRevs } from '../photoRev';
import { deriveWorld, type DerivedWorld } from './deriveWorld';
import type { ScheduleData } from '../schedule/port';
import { PortError, type CoachWorldPort, type PortErrorCode, type WorldData } from './port';

export type WorldStatus = 'loading' | 'ready' | 'stale' | 'offline' | 'error';

export interface WorldState {
  status: WorldStatus;
  world: DerivedWorld | null;
  /** when the shown data was fetched (cache time while stale) */
  updatedAt: number | null;
  refreshing: boolean;
  error: PortErrorCode | null;
  /** ops not yet confirmed by the server */
  unsynced: number;
}

/** The live schedule, seen from the world: the schedule store implements it (`schedule/feed.ts`). */
export interface ScheduleFeed {
  /** latest documents + requests, or null while nothing has loaded */
  peek(): ScheduleData | null;
  /** called on every change; returns the unsubscribe */
  subscribe(f: () => void): () => void;
  /** begin loading in the background (idempotent) */
  start?(): void;
}

export interface WorldStoreOptions {
  /** the schedule store as the single source of sessions (default: none, the port's snapshot is used) */
  schedule?: ScheduleFeed | null;
  now?: () => number;
  isOnline?: () => boolean;
  /** cap for one load; the UI never waits on it anyway (skeletons / cached data are already on screen) */
  timeoutMs?: number;
  /** automatic retry after a failed refresh: first delay, doubled each time up to `retryMaxMs`; 0 = off */
  retryBaseMs?: number;
  retryMaxMs?: number;
  /** background refresh period; 0 = off */
  refreshEveryMs?: number;
}

export interface WorldStore {
  getState(): WorldState;
  subscribe(f: () => void): () => void;
  start(): void;
  stop(): void;
  refresh(): Promise<void>;
  retry(): Promise<void>;
  setOnline(online: boolean): void;
  /** Optimistic write. Returns immediately; persistence happens in the background. */
  dispatch(op: BookOp): void;
}

/**
 * One load = the roster callable plus a read per client (cold function starts included). The cap used to be 8 s while a
 * single callable may take 15 s (`READ_TIMEOUT_MS`), so a slow-but-working backend ALWAYS ended in "Coach is taking too
 * long" (SPO-364). The cap now sits above the callable bound; the screen never waits on it (cache / skeleton first).
 */
export const WORLD_LOAD_TIMEOUT_MS = 30_000;
const DEFAULTS = {
  timeoutMs: WORLD_LOAD_TIMEOUT_MS,
  refreshEveryMs: 60_000,
  retryBaseMs: 2_000,
  retryMaxMs: 60_000,
};
/** Failures that more waiting cannot fix: no automatic retry (the person's Retry still works). */
const NO_AUTO_RETRY: ReadonlySet<PortErrorCode> = new Set(['forbidden', 'not-deployed']);

export function createWorldStore(port: CoachWorldPort, opts: WorldStoreOptions = {}): WorldStore {
  const now = opts.now ?? (port.now ? () => port.now!() : Date.now);
  let online = opts.isOnline
    ? opts.isOnline()
    : typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;
  const timeoutMs = opts.timeoutMs ?? DEFAULTS.timeoutMs;
  const every = opts.refreshEveryMs ?? DEFAULTS.refreshEveryMs;
  const retryBase = opts.retryBaseMs ?? DEFAULTS.retryBaseMs;
  const retryMax = opts.retryMaxMs ?? DEFAULTS.retryMaxMs;

  let data: WorldData | null = null;
  let remoteBook: DecisionBook = emptyBook();
  let book: DecisionBook = emptyBook();
  let fetchedAt: number | null = null;
  let queue: BookOp[] = [];
  let inflight: Promise<void> | null = null;
  let started = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let unsub: (() => void) | undefined;
  let unsubSchedule: (() => void) | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  /** the port's load that outlived its cap: it may still land and is then shown (never thrown away) */
  let straggler: Promise<WorldData> | null = null;
  let epoch = 0;
  const feed = opts.schedule ?? null;
  let state: WorldState = {
    status: 'loading',
    world: null,
    updatedAt: null,
    refreshing: false,
    error: null,
    unsynced: 0,
  };
  const subs = new Set<() => void>();

  const rebuildBook = () => {
    book = queue.reduce((b, op) => {
      try {
        return applyOp(b, op);
      } catch {
        return b; // an invalid op (e.g. dismiss without reason) never corrupts the book
      }
    }, remoteBook);
  };
  const publish = (p: Partial<WorldState>) => {
    state = { ...state, ...p };
    state.world = data ? deriveWorld(data, book, now(), feed?.peek() ?? null) : null;
    state.unsynced = queue.length;
    subs.forEach((f) => f());
  };
  const classify = (e: unknown): PortErrorCode =>
    e instanceof PortError ? e.code : online ? 'unavailable' : 'offline';

  async function flush(): Promise<void> {
    for (const op of [...queue]) {
      try {
        rebuildBook();
        await port.save(op, book);
        queue = queue.filter((q) => q !== op);
      } catch {
        return; // keep the rest queued; the next refresh retries
      }
    }
  }

  async function measureDue(): Promise<void> {
    if (!data?.outcomeData) return;
    const t = now();
    for (const d of book.decisions) {
      if (d.kind !== 'program' || d.windowEndsAt == null || d.windowEndsAt > t) continue;
      if (d.outcome && d.outcome.result !== 'measuring') continue;
      const od = data.outcomeData[d.signal.key];
      if (!od) continue;
      const r = measureDecision(d, od, t);
      if (r.outcome.result === 'measuring' && r.windowEndsAt === d.windowEndsAt) continue;
      queue.push({ t: 'outcome', id: d.id, outcome: r.outcome, windowEndsAt: r.windowEndsAt });
      rebuildBook();
    }
  }

  /** Adopt a fresh answer from the port (shared by the normal path and a load that landed after its cap). */
  async function applyFresh(fresh: WorldData): Promise<void> {
    data = fresh;
    rememberPhotoRevs(fresh.clients);
    remoteBook = fresh.book;
    rebuildBook();
    fetchedAt = now();
    failures = 0;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
    await measureDue();
    publish({ status: 'ready', updatedAt: fetchedAt, refreshing: false, error: null });
    await flush();
    publish({});
  }

  /** Quiet automatic retry with exponential backoff; the person's Retry stays as the fallback. */
  function scheduleRetry(code: PortErrorCode): void {
    if (!started || retryBase <= 0 || NO_AUTO_RETRY.has(code) || retryTimer) return;
    const delay = Math.min(retryMax, retryBase * 2 ** Math.min(failures, 16));
    failures++;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      if (started && online) void refresh();
    }, delay);
  }

  async function doRefresh(): Promise<void> {
    publish({ refreshing: true });
    const ctl = new AbortController();
    let to: ReturnType<typeof setTimeout> | undefined;
    const mine = epoch;
    try {
      // a load that outlived its cap is joined, not duplicated (a second one would only double the work)
      const load = straggler ?? port.load({ signal: ctl.signal });
      straggler = load;
      load.then(
        (fresh) => {
          // landed after its cap: show it unless something newer already did
          if (straggler === load) straggler = null;
          if (started && mine === epoch && state.status !== 'ready' && !inflight)
            void applyFresh(fresh);
        },
        () => {
          if (straggler === load) straggler = null;
        },
      );
      const fresh = await Promise.race([
        load,
        new Promise<never>((_, rej) => {
          to = setTimeout(() => {
            ctl.abort();
            rej(new PortError('timeout'));
          }, timeoutMs);
        }),
      ]);
      if (straggler === load) straggler = null;
      await applyFresh(fresh);
    } catch (e) {
      const code = online ? classify(e) : 'offline';
      if (data)
        publish({
          status: online ? 'stale' : 'offline',
          refreshing: false,
          error: online ? code : 'offline',
        });
      else publish({ status: online ? 'error' : 'offline', refreshing: false, error: code });
      if (online) scheduleRetry(code);
    } finally {
      if (to) clearTimeout(to);
    }
  }

  const refresh = (): Promise<void> => {
    if (inflight) return inflight; // never two loads at once
    inflight = doRefresh().finally(() => {
      inflight = null;
    });
    return inflight;
  };

  return {
    getState: () => state,
    subscribe(f) {
      subs.add(f);
      return () => void subs.delete(f);
    },
    start() {
      if (started) return;
      started = true;
      const adopt = (cached: { data: WorldData; fetchedAt: number }) => {
        data = cached.data;
        rememberPhotoRevs(cached.data.clients);
        remoteBook = cached.data.book;
        rebuildBook();
        fetchedAt = cached.fetchedAt;
        publish({ status: online ? 'stale' : 'offline', updatedAt: fetchedAt });
      };
      const cached = port.peek();
      if (cached) {
        adopt(cached);
      } else {
        publish({ status: online ? 'loading' : 'offline' });
        // the on-device snapshot may still be on its way (it waits for the vault key): show it the moment it lands,
        // unless the network answer got there first
        void port
          .hydrate?.()
          .then(() => {
            const c = port.peek();
            if (started && !data && c) adopt(c);
          })
          .catch(() => undefined);
      }
      void refresh();
      if (every > 0) timer = setInterval(() => void refresh(), every);
      unsub = port.subscribe?.(() => void refresh());
      if (feed) {
        // a reschedule answered anywhere re-derives the world at once (no reload): same session, same numbers
        unsubSchedule = feed.subscribe(() => {
          if (started && data) publish({});
        });
        feed.start?.();
      }
    },
    stop() {
      started = false;
      if (timer) clearInterval(timer);
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = undefined;
      failures = 0;
      epoch++;
      straggler = null;
      unsub?.();
      unsubSchedule?.();
      timer = undefined;
      unsub = undefined;
      unsubSchedule = undefined;
    },
    refresh,
    retry: refresh,
    setOnline(v) {
      const was = online;
      online = v;
      if (!v) publish({ status: 'offline' });
      else if (!was) {
        publish({ status: data ? 'stale' : 'loading' });
        void refresh();
      }
    },
    dispatch(op) {
      applyOp(book, op); // validate synchronously: an invalid op throws to the caller and is never queued
      queue.push(op);
      rebuildBook();
      publish({});
      void flush().then(() => publish({}));
    },
  };
}
