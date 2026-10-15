/**
 * The client's trainer-link store: ONE subscription per port, optimistic level changes, "Stop sharing" with an 8 s
 * Undo. Never throws and never blocks: until the first snapshot `status` is 'loading'; a failing write rolls back
 * and sets `failure` (the screens say it calmly and keep working).
 */
import type { Category, Consent, Level } from '../../domain/types';
import type { ClientCoachPort } from './port';
import { classifyProblem, type CoachProblem } from '../../data/problem';
import type { ClientSnapshot } from './types';

export const REVOKE_UNDO_MS = 8000;
/** Nothing cached and no first snapshot by then: an error with a reason, never an endless skeleton. */
export const FIRST_LOAD_TIMEOUT_MS = 8000;

export type ClientStatus = 'loading' | 'ready' | 'error';
export type ClientFailure = 'save' | 'revoke' | 'undo' | 'leave' | null;

export interface ClientState {
  snapshot: ClientSnapshot | null;
  status: ClientStatus;
  /** why `status` is 'error' (null otherwise) */
  problem: CoachProblem | null;
  failure: ClientFailure;
  /** "Sharing stopped. Undo" window */
  undo: { until: number; previous: Consent } | null;
}

export interface ClientStore {
  readonly port: ClientCoachPort;
  getState(): ClientState;
  subscribe(f: () => void): () => void;
  retain(): void;
  release(): void;
  /** Subscribe again after an `error` (the "Try again" of a screen with nothing cached). */
  retry(): void;
  setLevel(cat: Category, level: Level): Promise<boolean>;
  revoke(): Promise<boolean>;
  undoRevoke(): Promise<void>;
  leave(): Promise<boolean>;
  ackProgram(version: number): void;
  clearFailure(): void;
}

export function createClientStore(
  port: ClientCoachPort,
  undoMs = REVOKE_UNDO_MS,
  firstLoadMs = FIRST_LOAD_TIMEOUT_MS,
): ClientStore {
  const cached = port.peek();
  let state: ClientState = {
    snapshot: cached,
    status: cached ? 'ready' : 'loading',
    problem: null,
    failure: null,
    undo: null,
  };
  const subs = new Set<() => void>();
  let off: (() => void) | undefined;
  let users = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const set = (p: Partial<ClientState>) => {
    state = { ...state, ...p };
    subs.forEach((f) => f());
  };
  const closeUndo = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (state.undo) set({ undo: null });
  };
  let firstTimer: ReturnType<typeof setTimeout> | undefined;
  const stopFirstTimer = () => {
    if (firstTimer) clearTimeout(firstTimer);
    firstTimer = undefined;
  };
  const listen = () => {
    stopFirstTimer();
    if (!state.snapshot)
      firstTimer = setTimeout(() => {
        if (!state.snapshot && state.status === 'loading')
          set({ status: 'error', problem: 'timeout' });
      }, firstLoadMs);
    // the on-device snapshot may still be on its way (it waits for the vault key): show it the moment it lands,
    // unless the live answer got there first
    if (!state.snapshot)
      void port
        .hydrate?.()
        .then(() => {
          const c = port.peek();
          if (off && !state.snapshot && c) {
            stopFirstTimer();
            set({ snapshot: c, status: 'ready', problem: null });
          }
        })
        .catch(() => undefined);
    off = port.subscribe(
      (snapshot) => {
        stopFirstTimer();
        set({ snapshot, status: 'ready', problem: null });
      },
      (e) => {
        stopFirstTimer();
        set(
          state.snapshot ? { status: 'ready' } : { status: 'error', problem: classifyProblem(e) },
        );
      },
    );
  };
  return {
    port,
    getState: () => state,
    subscribe(f) {
      subs.add(f);
      return () => void subs.delete(f);
    },
    retain() {
      users++;
      if (off) return;
      listen();
    },
    retry() {
      if (users === 0) return;
      off?.();
      off = undefined;
      set({ status: state.snapshot ? 'ready' : 'loading', problem: null });
      listen();
    },
    release() {
      users = Math.max(0, users - 1);
      if (users === 0) {
        off?.();
        off = undefined;
        stopFirstTimer();
        closeUndo();
      }
    },
    async setLevel(cat, level) {
      const before = state.snapshot;
      if (!before) return false;
      // optimistic: the page behind the sheet updates at once
      set({
        failure: null,
        snapshot: {
          ...before,
          link: { ...before.link, grants: { ...before.link.grants, [cat]: level } },
        },
      });
      try {
        await port.setLevel(cat, level);
        return true;
      } catch {
        set({ snapshot: before, failure: 'save' });
        return false;
      }
    },
    async revoke() {
      try {
        const { previous } = await port.revoke();
        closeUndo();
        set({ failure: null, undo: { until: Date.now() + undoMs, previous } });
        timer = setTimeout(closeUndo, undoMs);
        return true;
      } catch {
        set({ failure: 'revoke' });
        return false;
      }
    },
    async undoRevoke() {
      const u = state.undo;
      if (!u) return;
      closeUndo();
      try {
        await port.restore(u.previous);
      } catch {
        set({ failure: 'undo' });
      }
    },
    async leave() {
      try {
        await port.leave();
        return true;
      } catch {
        set({ failure: 'leave' });
        return false;
      }
    },
    ackProgram(version) {
      void port.ackProgram(version).catch(() => undefined);
    },
    clearFailure: () => set({ failure: null }),
  };
}

const stores = new WeakMap<ClientCoachPort, ClientStore>();
export function clientStoreFor(port: ClientCoachPort): ClientStore {
  let s = stores.get(port);
  if (!s) stores.set(port, (s = createClientStore(port)));
  return s;
}
