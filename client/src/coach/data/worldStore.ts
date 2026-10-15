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
  /** hard cap for one load; the UI never waits on it anyway */
  timeoutMs?: number;
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

const DEFAULTS = { timeoutMs: 8_000, refreshEveryMs: 60_000 };

export function createWorldStore(port: CoachWorldPort, opts: WorldStoreOptions = {}): WorldStore {
  const now = opts.now ?? (port.now ? () => port.now!() : Date.now);
  let online = opts.isOnline
    ? opts.isOnline()
    : typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;
  const timeoutMs = opts.timeoutMs ?? DEFAULTS.timeoutMs;
  const every = opts.refreshEveryMs ?? DEFAULTS.refreshEveryMs;

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

  async function doRefresh(): Promise<void> {
    publish({ refreshing: true });
    const ctl = new AbortController();
    let to: ReturnType<typeof setTimeout> | undefined;
    try {
      const fresh = await Promise.race([
        port.load({ signal: ctl.signal }),
        new Promise<never>((_, rej) => {
          to = setTimeout(() => {
            ctl.abort();
            rej(new PortError('timeout'));
          }, timeoutMs);
        }),
      ]);
      data = fresh;
      remoteBook = fresh.book;
      rebuildBook();
      fetchedAt = now();
      await measureDue();
      publish({ status: 'ready', updatedAt: fetchedAt, refreshing: false, error: null });
      await flush();
      publish({});
    } catch (e) {
      const code = online ? classify(e) : 'offline';
      if (data)
        publish({
          status: online ? 'stale' : 'offline',
          refreshing: false,
          error: online ? code : 'offline',
        });
      else publish({ status: online ? 'error' : 'offline', refreshing: false, error: code });
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
