/**
 * Schedule store: one live subscription to the port, optimistic edits and requests, never blocking.
 *   - `start()` paints the cached snapshot at once (`stale`) and listens; no cache + no answer = `loading` (skeletons);
 *   - an edit is applied to the newest doc and written with `rev`; a lost race re-reads, re-applies the SAME edit and
 *     retries once, else `failed = 'conflict'` ("Schedule changed. Review and save again", R-BE-CAL-3);
 *   - a builder save is undoable for 8 s (Undo removes exactly what the save added);
 *   - requests: create (+ the chat card through `onRequest`), answer, cancel, counter-proposal (old = countered, new
 *     pending with `supersedes`); the state machine is `requests.ts`; a write that fails is rolled back and flagged.
 */
import { UNDO_MS } from '../chat/types';
import { addOneOff, addPattern, cancelInstance, mark, removeCreated, type DocEdit } from './edits';
import { newId } from './ids';
import { generateSlots, statusAt } from './model';
import { SchedulePortError, type ScheduleData, type SchedulePort } from './port';
import { answer, createRequest, RequestError, type RequestDraft } from './requests';
import {
  emptyDoc,
  type OneOffDoc,
  type PatternDoc,
  type ReqStatus,
  type RescheduleRequest,
  type ScheduleDoc,
  type ScheduleSlot,
} from './types';

export type ScheduleStatus = 'loading' | 'ready' | 'stale' | 'offline' | 'error';
export type ScheduleFailure =
  'save' | 'conflict' | 'request' | 'answer' | 'expired' | 'vault-locked' | 'limit' | null;

/** The server (or the local state machine) refused an answer because the request ran out: a clear message, not "try again". */
const isExpired = (e: unknown): boolean => {
  const x = e as { code?: unknown; reason?: unknown; message?: unknown } | null;
  return (
    x?.code === 'expired' ||
    x?.reason === 'expired' ||
    (typeof x?.message === 'string' && /\bexpired\b/.test(x.message))
  );
};

export interface PendingSave {
  token: string;
  label: string;
  count: number;
  until: number;
  patternIds: string[];
  oneOffIds: string[];
  clientIds: string[];
}

export interface ScheduleState {
  status: ScheduleStatus;
  docs: readonly ScheduleDoc[];
  requests: readonly RescheduleRequest[];
  asOf: number | null;
  pendingSave: PendingSave | null;
  failed: ScheduleFailure;
  /** edits not yet confirmed by the port */
  unsynced: number;
}

export interface SaveCreate {
  /** one attendee per doc: a solo plan has one, a split / group has them all */
  clientIds: string[];
  pattern?: PatternDoc;
  oneOff?: OneOffDoc;
  /** the toast text */
  label: string;
}

export interface ScheduleStoreOptions {
  /** called after a request was created: post the chat card through the installed chat port (`useSchedule.postRequestCard`) */
  onRequest?: (r: RescheduleRequest) => void;
  isOnline?: () => boolean;
}

export interface ScheduleStore {
  readonly port: SchedulePort;
  getState(): ScheduleState;
  subscribe(f: () => void): () => void;
  start(): void;
  stop(): void;
  setOnline(v: boolean): void;
  retry(): void;
  now(): number;
  /** Create sessions (builder / one-off). Resolves true when written. */
  save(c: SaveCreate): Promise<boolean>;
  undoSave(): Promise<void>;
  settleSave(): void;
  /** Trainer: cancel one session for everyone, or remove one person from a shared one. */
  cancelSession(slot: ScheduleSlot, clientId?: string): Promise<boolean>;
  markMissed(slot: ScheduleSlot, clientId: string): Promise<boolean>;
  /** The session took place for this person (a past session the trainer confirms). */
  markDone(slot: ScheduleSlot, clientId: string): Promise<boolean>;
  /** Whole-session move: this person stays on the old time, the others move. */
  keepOnOldTime(slot: ScheduleSlot, clientId: string): Promise<boolean>;
  request(drafts: Omit<RequestDraft, 'id' | 'now'>[]): Promise<RescheduleRequest[] | null>;
  respond(
    id: string,
    to: Exclude<ReqStatus, 'pending' | 'expired'>,
    side?: 'trainer' | 'client',
  ): Promise<boolean>;
  /** "Suggest another time": the old request is countered, a new one supersedes it. */
  counter(
    oldId: string,
    draft: Omit<RequestDraft, 'id' | 'now' | 'supersedes' | 'from'>,
  ): Promise<RescheduleRequest | null>;
  /**
   * Withdraw the requests of a whole-session move that are still open (pending, not expired).
   * An accepted request is an answer already given: it is never auto-cancelled.
   */
  cancelGroup(groupKey: string): Promise<boolean>;
  clearFailed(): void;
}

export function createScheduleStore(
  port: SchedulePort,
  opts: ScheduleStoreOptions = {},
): ScheduleStore {
  let state: ScheduleState = {
    status: 'loading',
    docs: [],
    requests: [],
    asOf: null,
    pendingSave: null,
    failed: null,
    unsynced: 0,
  };
  let online = opts.isOnline
    ? opts.isOnline()
    : typeof navigator === 'undefined' || navigator.onLine !== false;
  let started = false;
  let off: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const subs = new Set<() => void>();
  const set = (p: Partial<ScheduleState>) => {
    state = { ...state, ...p };
    subs.forEach((f) => f());
  };
  const bump = (d: number) => set({ unsynced: Math.max(0, state.unsynced + d) });

  const apply = (d: ScheduleData, status: ScheduleStatus = 'ready') =>
    set({ docs: d.docs, requests: d.requests, asOf: d.asOf, status });

  const docOf = (id: string): ScheduleDoc =>
    state.docs.find((d) => d.clientId === id) ?? emptyDoc(id);
  const putDoc = (d: ScheduleDoc) =>
    set({ docs: [...state.docs.filter((x) => x.clientId !== d.clientId), d] });

  /** Apply `edit` to the newest doc and write it; one retry after a lost race. */
  async function editDoc(clientId: string, edit: DocEdit): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const base = docOf(clientId);
      const next = edit(base);
      const before = state.docs;
      putDoc(next); // optimistic
      bump(1);
      try {
        const saved = await port.saveDoc(next);
        putDoc(saved);
        return true;
      } catch (e) {
        set({ docs: before });
        if (e instanceof SchedulePortError && e.code === 'conflict') {
          const fresh = port.peek();
          if (fresh) apply(fresh, state.status);
          if (attempt === 0) continue;
          set({ failed: 'conflict' });
          return false;
        }
        set({
          failed:
            e instanceof SchedulePortError && e.code === 'vault-locked' ? 'vault-locked' : 'save',
        });
        return false;
      } finally {
        bump(-1);
      }
    }
    return false;
  }

  async function editMany(ids: readonly string[], edit: DocEdit): Promise<boolean> {
    let ok = true;
    for (const id of ids) ok = (await editDoc(id, edit)) && ok;
    return ok;
  }

  function settle() {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (state.pendingSave) set({ pendingSave: null });
  }

  const store: ScheduleStore = {
    port,
    getState: () => state,
    subscribe(f) {
      subs.add(f);
      return () => void subs.delete(f);
    },
    now: () => port.now(),
    start() {
      if (started) return;
      started = true;
      const cached = port.peek();
      if (cached) apply(cached, online ? 'stale' : 'offline');
      else set({ status: online ? 'loading' : 'offline' });
      off = port.subscribe(
        (d) => apply(d, 'ready'),
        () =>
          set({
            status: state.docs.length
              ? online
                ? 'stale'
                : 'offline'
              : online
                ? 'error'
                : 'offline',
          }),
      );
    },
    stop() {
      started = false;
      off?.();
      off = undefined;
      settle();
    },
    setOnline(v) {
      online = v;
      if (!v) set({ status: 'offline' });
      else if (started) {
        off?.();
        off = port.subscribe(
          (d) => apply(d, 'ready'),
          () => set({ status: state.docs.length ? 'stale' : 'error' }),
        );
      }
    },
    retry() {
      if (!started) return;
      off?.();
      set({ status: state.docs.length ? 'stale' : 'loading' });
      off = port.subscribe(
        (d) => apply(d, 'ready'),
        () => set({ status: state.docs.length ? 'stale' : 'error' }),
      );
    },

    async save(c) {
      settle();
      const edit: DocEdit = (d) => {
        let x = d;
        if (c.pattern) x = addPattern(c.pattern)(x);
        if (c.oneOff) x = addOneOff(c.oneOff)(x);
        return x;
      };
      try {
        const ok = await editMany(c.clientIds, edit);
        if (!ok) return false;
      } catch {
        set({ failed: 'limit' });
        return false;
      }
      const count = c.pattern
        ? generateSlots(
            c.clientIds.slice(0, 1).map((id) => docOf(id)),
            [],
            {
              fromDay: c.pattern.fromDay,
              toDay: c.pattern.fromDay + c.pattern.weeks * 7 + 7,
              now: port.now(),
            },
          ).filter((s) => c.pattern!.rows.some((r) => s.key.startsWith(`${r.id}:`))).length
        : 1;
      const until = port.now() + UNDO_MS;
      set({
        pendingSave: {
          token: newId('sv-'),
          label: c.label,
          count,
          until,
          patternIds: c.pattern ? [c.pattern.id] : [],
          oneOffIds: c.oneOff ? [c.oneOff.id] : [],
          clientIds: [...c.clientIds],
        },
      });
      timer = setTimeout(settle, UNDO_MS);
      return true;
    },
    async undoSave() {
      const p = state.pendingSave;
      if (!p) return;
      settle();
      await editMany(p.clientIds, removeCreated(p.patternIds, p.oneOffIds));
    },
    settleSave: settle,

    async cancelSession(slot, clientId) {
      const ids = clientId ? [clientId] : slot.attendees.map((a) => a.clientId);
      return editMany(ids, cancelInstance(slot.key));
    },
    async markMissed(slot, clientId) {
      return editDoc(clientId, mark({ slotKey: slot.key, status: 'missed' }));
    },
    async markDone(slot, clientId) {
      return editDoc(clientId, mark({ slotKey: slot.key, status: 'done' }));
    },
    async keepOnOldTime(slot, clientId) {
      return editDoc(clientId, mark({ slotKey: slot.key, status: 'kept' }));
    },

    async request(drafts) {
      const now = port.now();
      const made: RescheduleRequest[] = [];
      let all = [...state.requests];
      for (const d of drafts) {
        const r = createRequest({ ...d, id: newId('rq-'), now }, all); // throws RequestError: the form shows why
        made.push(r);
        all = [...all, r];
      }
      const before = state.requests;
      set({ requests: all });
      bump(made.length);
      try {
        for (const r of made) await port.createRequest(r);
      } catch {
        set({ requests: before, failed: 'request' });
        return null;
      } finally {
        bump(-made.length);
      }
      made.forEach((r) => opts.onRequest?.(r));
      return made;
    },

    async respond(id, to, side = 'trainer') {
      const r = state.requests.find((x) => x.id === id);
      if (!r) return false;
      const now = port.now();
      if (statusAt(r, now) === 'expired') {
        set({ failed: 'expired' }); // a late answer says why, whatever the stored status already is
        return false;
      }
      let next: RescheduleRequest;
      try {
        next = answer(r, to, side, now);
      } catch (e) {
        set({ failed: isExpired(e) ? 'expired' : 'answer' });
        return false;
      }
      if (next === r) return true;
      const before = state.requests;
      set({ requests: state.requests.map((x) => (x.id === id ? next : x)) });
      bump(1);
      try {
        await port.setStatus(r, to, now);
        return true;
      } catch (e) {
        set({ requests: before, failed: isExpired(e) ? 'expired' : 'answer' });
        return false;
      } finally {
        bump(-1);
      }
    },

    async counter(oldId, draft) {
      const old = state.requests.find((x) => x.id === oldId);
      if (!old) return null;
      const side = old.from === 'client' ? 'trainer' : 'client';
      const now = port.now();
      if (statusAt(old, now) === 'expired') {
        set({ failed: 'expired' });
        return null;
      }
      let countered: RescheduleRequest;
      let fresh: RescheduleRequest;
      try {
        countered = answer(old, 'countered', side, now);
        const rest = state.requests.map((x) => (x.id === oldId ? countered : x));
        fresh = createRequest(
          { ...draft, id: newId('rq-'), from: side, supersedes: oldId, now },
          rest,
        );
      } catch (e) {
        if (e instanceof RequestError && e.code === 'expired') {
          set({ failed: 'expired' });
          return null;
        }
        if (e instanceof RequestError) throw e;
        set({ failed: 'request' });
        return null;
      }
      const before = state.requests;
      set({ requests: [...state.requests.map((x) => (x.id === oldId ? countered : x)), fresh] });
      bump(2);
      try {
        await port.setStatus(old, 'countered', now);
        await port.createRequest(fresh);
      } catch (e) {
        set({ requests: before, failed: isExpired(e) ? 'expired' : 'request' });
        return null;
      } finally {
        bump(-2);
      }
      opts.onRequest?.(fresh);
      return fresh;
    },

    async cancelGroup(groupKey) {
      const open = state.requests.filter(
        (r) => r.groupKey === groupKey && statusAt(r, port.now()) === 'pending',
      );
      let ok = true;
      const now = port.now();
      for (const r of open) {
        const before = state.requests;
        set({
          requests: state.requests.map((x) =>
            x.id === r.id ? { ...x, status: 'cancelled', decidedAt: now } : x,
          ),
        });
        try {
          await port.setStatus(r, 'cancelled', now);
        } catch {
          set({ requests: before, failed: 'answer' });
          ok = false;
        }
      }
      return ok;
    },
    clearFailed: () => set({ failed: null }),
  };
  return store;
}
