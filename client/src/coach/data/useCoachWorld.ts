import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { DismissReason } from '../domain/decisions';
import type { Option } from '../domain/diff';
import type { Signal } from '../domain/types';
import type { BookOp } from './bookOps';
import { getScheduleFeed, getWorldPort } from './config';
import type { CoachWorldPort } from './port';
import {
  createWorldStore,
  type WorldState,
  type WorldStore,
  type WorldStoreOptions,
} from './worldStore';

interface Entry {
  store: WorldStore;
  users: number;
}
const entries = new WeakMap<CoachWorldPort, Entry>();

const retain = (e: Entry): void => {
  e.users++;
};
/** true when the last reader left */
const releaseLast = (e: Entry): boolean => --e.users <= 0;

function entryFor(port: CoachWorldPort, opts?: WorldStoreOptions): Entry {
  let e = entries.get(port);
  if (!e) {
    // with the real backend the schedule store is the single source of sessions and the world follows it (deriveWorld);
    // fixtures and tests keep the snapshot of their own world port unless they pass a feed
    const schedule = opts && 'schedule' in opts ? opts.schedule : getScheduleFeed();
    e = { store: createWorldStore(port, { ...opts, schedule }), users: 0 };
    entries.set(port, e);
  }
  return e;
}

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export interface CoachWorldApi extends WorldState {
  /** loading = nothing to show yet: draw skeletons (R-FE-090), never a full-screen overlay */
  loading: boolean;
  retry(): void;
  recordDecision(signal: Signal, option: Option, message?: string): string;
  /** Undo of a just-recorded decision (the Decision screen offers it for 8 s). */
  undoDecision(id: string): void;
  snooze(signal: Signal): string;
  dismiss(signal: Signal, reason: DismissReason): string;
  acknowledge(signal: Signal): void;
  /** End the relationship with a client; resolves false when the backend cannot or the call failed. */
  endCoaching(clientId: string): Promise<boolean>;
}

/**
 * The single source for Roster, Today, Signals, Decisions and Week counts. Renders immediately from the local
 * cache; the network runs in the background (status `stale` + `updatedAt` = "Updated 14:02"); offline and error
 * are states of the data, not blockers. `port` / `options` are injectable (tests, stories, the real adapter).
 */
export function useCoachWorld(port?: CoachWorldPort, options?: WorldStoreOptions): CoachWorldApi {
  const p = port ?? getWorldPort();
  const entry = entryFor(p, options);
  const store = entry.store;
  useEffect(() => {
    retain(entry);
    store.start();
    const on = () => store.setOnline(true);
    const off = () => store.setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      if (releaseLast(entry)) store.stop();
    };
  }, [entry, store]);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const retry = useCallback(() => void store.retry(), [store]);
  const actions = useMemo(() => {
    const now = () => (p.now ? p.now() : Date.now());
    const d = (op: BookOp) => store.dispatch(op);
    return {
      recordDecision(signal: Signal, option: Option, message = '') {
        const id = newId();
        d({ t: 'record', id, signal, option, message, now: now() });
        return id;
      },
      undoDecision(id: string) {
        d({ t: 'undo', id });
      },
      snooze(signal: Signal) {
        const id = newId();
        d({ t: 'snooze', id, signal, now: now() });
        return id;
      },
      dismiss(signal: Signal, reason: DismissReason) {
        const id = newId();
        d({ t: 'dismiss', id, signal, reason, now: now() });
        return id;
      },
      acknowledge(signal: Signal) {
        d({ t: 'ack', signal, now: now() });
      },
      /** `false` when this backend cannot end a relationship or the call failed (the caller says so calmly). */
      async endCoaching(clientId: string): Promise<boolean> {
        if (!p.endCoaching) return false;
        try {
          await p.endCoaching(clientId);
        } catch {
          return false;
        }
        await store.refresh();
        return true;
      },
    };
  }, [store, p]);
  return { ...state, loading: state.status === 'loading', retry, ...actions };
}
