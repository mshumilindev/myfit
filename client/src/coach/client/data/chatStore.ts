/**
 * Client chat store: the outbox of unsent messages and the single pending undoable operation (message delete / clear),
 * same rules as the trainer's store (8 s window, one toast at a time). Never throws, never blocks.
 */
import { UNDO_MS, type ChatMessage, type MsgBody, type PendingUndo } from '../../chat/types';
import type { ClientChatPort } from './chatPort';

export interface ClientOutbox {
  id: string;
  cid: string;
  text: string;
  body?: MsgBody;
  at: number;
  state: 'sending' | 'failed';
}
export interface ClientChatState {
  outbox: readonly ClientOutbox[];
  pending: PendingUndo | null;
}
export interface ClientChatStore {
  readonly port: ClientChatPort;
  getState(): ClientChatState;
  subscribe(f: () => void): () => void;
  send(cid: string, text: string, body?: MsgBody): string;
  retry(id: string): void;
  discard(id: string): void;
  markRead(cid: string): void;
  deleteMessage(cid: string, id: string): void;
  clearChat(cid: string): void;
  undo(): void;
  /** leaving the chat closes a pending erase now */
  settle(): void;
}

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function createClientChatStore(port: ClientChatPort, undoMs = UNDO_MS): ClientChatStore {
  let state: ClientChatState = { outbox: [], pending: null };
  const subs = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let commit: (() => Promise<void>) | null = null;
  let revert: (() => Promise<void>) | null = null;
  const set = (p: Partial<ClientChatState>) => {
    state = { ...state, ...p };
    subs.forEach((f) => f());
  };
  const quiet = (p: Promise<unknown>) => void p.catch(() => undefined);
  const settle = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const c = commit;
    commit = null;
    revert = null;
    if (state.pending) set({ pending: null });
    if (c) quiet(c());
  };
  const open = (
    p: Omit<PendingUndo, 'until'>,
    doCommit: () => Promise<void>,
    doRevert: () => Promise<void>,
  ) => {
    settle();
    commit = doCommit;
    revert = doRevert;
    set({ pending: { ...p, until: Date.now() + undoMs } });
    timer = setTimeout(settle, undoMs);
  };
  const patch = (f: (l: readonly ClientOutbox[]) => readonly ClientOutbox[]) =>
    set({ outbox: f(state.outbox) });
  const transmit = (m: ClientOutbox) =>
    port
      .send(m.cid, { id: m.id, text: m.text, at: m.at, ...(m.body ? { body: m.body } : {}) })
      .then(() => patch((l) => l.filter((x) => x.id !== m.id)))
      .catch(() => patch((l) => l.map((x) => (x.id === m.id ? { ...x, state: 'failed' } : x))));
  return {
    port,
    getState: () => state,
    subscribe(f) {
      subs.add(f);
      return () => void subs.delete(f);
    },
    send(cid, text, body) {
      const m: ClientOutbox = {
        id: newId(),
        cid,
        text: text.trim(),
        ...(body ? { body } : {}),
        at: port.now(),
        state: 'sending',
      };
      patch((l) => [...l, m]);
      void transmit(m);
      return m.id;
    },
    retry(id) {
      const m = state.outbox.find((x) => x.id === id);
      if (!m) return;
      patch((l) => l.map((x) => (x.id === id ? { ...x, state: 'sending' } : x)));
      void transmit({ ...m, state: 'sending' });
    },
    discard: (id) => patch((l) => l.filter((x) => x.id !== id)),
    markRead: (cid) => quiet(port.markRead(cid)),
    deleteMessage(cid, id) {
      port
        .softDelete(cid, id)
        .then(() =>
          open(
            { kind: 'message', cid, id },
            () => port.commitDelete(cid, id),
            () => port.undoDelete(cid, id),
          ),
        )
        .catch(() => undefined);
    },
    clearChat(cid) {
      port
        .clearChat(cid)
        .then(({ previous }) =>
          open(
            { kind: 'chat', cid },
            async () => undefined,
            () => port.undoClear(cid, previous),
          ),
        )
        .catch(() => undefined);
    },
    undo() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      const r = revert;
      commit = null;
      revert = null;
      set({ pending: null });
      if (r) quiet(r());
    },
    settle,
  };
}

const stores = new WeakMap<ClientChatPort, ClientChatStore>();
export function clientChatStoreFor(port: ClientChatPort): ClientChatStore {
  let s = stores.get(port);
  if (!s) stores.set(port, (s = createClientChatStore(port)));
  return s;
}

/** An unsent message shows at the end, in compose order, as mine. */
export function mergeClientOutbox(
  messages: readonly ChatMessage[],
  outbox: readonly ClientOutbox[],
  cid: string,
): ChatMessage[] {
  const known = new Set(messages.map((m) => m.id));
  const extra = outbox
    .filter((o) => o.cid === cid && !known.has(o.id))
    .map((o): ChatMessage => ({
      id: o.id,
      cid: o.cid,
      from: 'client',
      at: o.at,
      body: o.body ?? { kind: 'text', text: o.text },
      state: o.state,
    }));
  return [...messages, ...extra].sort((a, b) => a.at - b.at);
}
