/**
 * The draft of ONE client's program, shared by the editor and "Check before sending" (they are two routes over the same
 * draft: fixing in the editor changes the check at once, and nothing is lost on the way back). Renders from the local cache
 * at once; the network runs in the background and never replaces edits in progress. Saving is optimistic-concurrency
 * (`rev`): a stale save is a conflict the trainer resolves, not an overwrite.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Program } from '../../views/programs/model';
import type { Dow } from '../domain/types';
import { getProgramPort } from './config';
import type { ProgramPort } from './port';
import { ProgramPortError, type ProgramBundle, type ProgramPortErrorCode } from './types';
import { runCheck, type Check, type CheckContext } from './check';

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'sending' }
  | { kind: 'saved'; at: number }
  | { kind: 'sent'; version: number }
  | { kind: 'error'; code: ProgramPortErrorCode; during: 'save' | 'send' };

export interface DraftState {
  /** nothing to show yet: skeletons (never a full-screen preloader) */
  loading: boolean;
  /** a background refresh failed and there is no bundle */
  error: 'offline' | 'forbidden' | 'unavailable' | null;
  bundle: ProgramBundle | null;
  draft: Program | null;
  trainerDays: Dow[];
  dirty: boolean;
  save: SaveState;
  /** Undo steps (a mode switch offers "Muscles set . Undo"). */
  undo: { label: string; draft: Program }[];
}

const INITIAL: DraftState = {
  loading: true,
  error: null,
  bundle: null,
  draft: null,
  trainerDays: [],
  dirty: false,
  save: { kind: 'idle' },
  undo: [],
};

export interface DraftStore {
  getState(): DraftState;
  subscribe(l: () => void): () => void;
  start(): void;
  stop(): void;
  retry(): void;
  /** Change the draft; `undoLabel` makes the change undoable. */
  edit(fn: (p: Program) => Program, undoLabel?: string): void;
  undo(): void;
  setTrainerDays(d: Dow[]): void;
  saveDraft(): Promise<void>;
  send(): Promise<void>;
  copyTo(targetClientId: string): Promise<void>;
  /** Discard local edits and take the server's draft (after a conflict). */
  reload(): void;
}

export function createDraftStore(port: ProgramPort, clientId: string): DraftStore {
  let state: DraftState = INITIAL;
  const listeners = new Set<() => void>();
  let ctl: AbortController | null = null;
  const set = (p: Partial<DraftState>) => {
    state = { ...state, ...p };
    listeners.forEach((l) => l());
  };
  const adopt = (b: ProgramBundle, keepEdits: boolean) => {
    if (keepEdits && state.draft && state.dirty) {
      // Edits in progress win; the base revision moves so the next save is judged against the server's.
      set({ bundle: b, loading: false, error: null });
      return;
    }
    set({
      bundle: b,
      draft: b.draft,
      trainerDays: [...b.trainerDays],
      dirty: false,
      loading: false,
      error: null,
      undo: [],
    });
  };
  const load = () => {
    ctl?.abort();
    ctl = new AbortController();
    port
      .load(clientId, { signal: ctl.signal })
      .then((b) => adopt(b, true))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        const code = e instanceof ProgramPortError ? e.code : 'unavailable';
        if (!state.bundle)
          set({
            loading: false,
            error: code === 'offline' || code === 'forbidden' ? code : 'unavailable',
          });
      });
  };
  const body = () => ({
    draft: state.draft!,
    trainerDays: state.trainerDays,
    baseRev: state.bundle!.rev,
  });
  const fail = (e: unknown, during: 'save' | 'send') =>
    set({
      save: { kind: 'error', code: e instanceof ProgramPortError ? e.code : 'unavailable', during },
    });
  const api: DraftStore = {
    getState: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    start() {
      if (state.bundle) return;
      const cached = port.peek(clientId);
      if (cached) adopt(cached, false);
      load();
    },
    stop() {
      ctl?.abort();
    },
    retry() {
      if (!state.bundle) set({ loading: true, error: null });
      load();
    },
    edit(fn, undoLabel) {
      if (!state.draft) return;
      const next = fn(state.draft);
      if (next === state.draft) return;
      set({
        draft: next,
        dirty: true,
        save: { kind: 'idle' },
        undo: undoLabel
          ? [...state.undo, { label: undoLabel, draft: state.draft }].slice(-5)
          : state.undo,
      });
    },
    undo() {
      const last = state.undo[state.undo.length - 1];
      if (!last) return;
      set({ draft: last.draft, undo: state.undo.slice(0, -1), dirty: true });
    },
    setTrainerDays(d) {
      set({ trainerDays: d, dirty: true, save: { kind: 'idle' } });
    },
    async saveDraft() {
      if (!state.draft || !state.bundle || state.save.kind === 'saving') return;
      set({ save: { kind: 'saving' } });
      try {
        const r = await port.saveDraft(clientId, body());
        set({
          bundle: {
            ...state.bundle,
            rev: r.rev,
            draft: state.draft,
            trainerDays: [...state.trainerDays],
          },
          dirty: false,
          save: { kind: 'saved', at: Date.now() },
        });
      } catch (e) {
        fail(e, 'save');
      }
    },
    async send() {
      if (!state.draft || !state.bundle || state.save.kind === 'sending') return;
      set({ save: { kind: 'sending' } });
      try {
        const r = await port.send(clientId, body());
        const b = state.bundle;
        set({
          bundle: {
            ...b,
            rev: r.rev,
            live: state.draft,
            draft: state.draft,
            liveVersion: r.version,
            draftVersion: r.version + 1,
            trainerDays: [...state.trainerDays],
            sentAt: Date.now(),
            seen: null,
          },
          dirty: false,
          undo: [],
          save: { kind: 'sent', version: r.version },
        });
      } catch (e) {
        fail(e, 'send');
      }
    },
    async copyTo(target) {
      if (!state.bundle) return;
      // The copy is of what the server holds, so a dirty draft is saved first.
      if (state.dirty) await api.saveDraft();
      if (state.save.kind === 'error') return;
      await port.copyTo(clientId, target);
      const b = state.bundle!;
      set({
        bundle: {
          ...b,
          sharedWith: b.sharedWith.map((s) =>
            s.clientId === target ? { ...s, version: b.draftVersion } : s,
          ),
        },
      });
    },
    reload() {
      set({ dirty: false, save: { kind: 'idle' }, undo: [] });
      load();
      // `adopt(…, true)` keeps nothing now that dirty is false
    },
  };
  return api;
}

interface Entry {
  store: DraftStore;
  users: number;
}
const registry = new WeakMap<ProgramPort, Map<string, Entry>>();
function entryFor(port: ProgramPort, cid: string): Entry {
  let m = registry.get(port);
  if (!m) registry.set(port, (m = new Map()));
  let e = m.get(cid);
  if (!e) m.set(cid, (e = { store: createDraftStore(port, cid), users: 0 }));
  return e;
}

/** Count the screens reading one client's draft; the store stops with the last one. */
function retain(entry: Entry): () => void {
  entry.users++;
  entry.store.start();
  return () => {
    entry.users--;
    if (entry.users <= 0) entry.store.stop();
  };
}

export interface ProgramDraftApi extends DraftState {
  /** The check of the current draft (null until the draft is there). */
  check: Check | null;
  retry(): void;
  edit: DraftStore['edit'];
  undoLast(): void;
  setTrainerDays: DraftStore['setTrainerDays'];
  saveDraft: DraftStore['saveDraft'];
  send: DraftStore['send'];
  copyTo: DraftStore['copyTo'];
  reload: DraftStore['reload'];
}

export function useProgramDraft(
  clientId: string,
  ctx: CheckContext,
  port?: ProgramPort,
): ProgramDraftApi {
  const p = port ?? getProgramPort();
  const entry = entryFor(p, clientId);
  const store = entry.store;
  useEffect(() => retain(entry), [entry]);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const restrictionKey = ctx.restrictions.join('|');
  const check = useMemo(
    () =>
      state.draft
        ? runCheck(state.draft, {
            injury: ctx.injury,
            restrictions: restrictionKey ? restrictionKey.split('|') : [],
          })
        : null,
    [state.draft, ctx.injury, restrictionKey],
  );
  const undoLast = useCallback(() => store.undo(), [store]);
  return {
    ...state,
    check,
    retry: store.retry,
    edit: store.edit,
    undoLast,
    setTrainerDays: store.setTrainerDays,
    saveDraft: store.saveDraft,
    send: store.send,
    copyTo: store.copyTo,
    reload: store.reload,
  };
}
