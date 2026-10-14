/**
 * The chat store: ONE subscription to the trainer's conversation list per port (shared by the chat list, the nav
 * badges and the dock, R-BE-CHAT-4), the outbox of unsent messages, and the single pending undoable operation.
 *
 * Never throws, never blocks: until the first snapshot the list is empty and `status` is 'loading'; a listener
 * error keeps the last known list ('error' is a state of the data, not a blocker).
 */
import type { ConversationsPort, ConversationUnreadDoc } from '../data/unreadStore';
import type { ChatPort } from './port';
import type { SealedLocal } from './sealedLocal';
import {
  UNDO_MS,
  type ChatMessage,
  type ChatThread,
  type MsgBody,
  type PendingUndo,
} from './types';

/** Unsent messages kept per conversation on the device. */
const OUTBOX_MAX = 50;

export type ThreadsStatus = 'loading' | 'ready' | 'error';

export interface OutboxMessage {
  id: string;
  cid: string;
  text: string;
  /** M5: a share (or other non-text) body; `text` is then its caption. */
  body?: MsgBody;
  at: number;
  state: 'sending' | 'failed';
}

export interface ChatState {
  threads: readonly ChatThread[];
  status: ThreadsStatus;
  outbox: Readonly<Record<string, readonly OutboxMessage[]>>;
  pending: PendingUndo | null;
}

export interface ChatStore {
  readonly port: ChatPort;
  getState(): ChatState;
  subscribe(f: () => void): () => void;
  /** Reference-counted: the first reader starts the thread listener, the last one stops it. */
  retain(uid: string): void;
  release(): void;
  restart(): void;
  send(cid: string, text: string, body?: MsgBody): string;
  retrySend(cid: string, id: string): void;
  /**
   * Sealed on-device storage (Part C.2 no. 9): the outbox survives a reload and is sent when the connection is
   * back. Until a key exists nothing is stored (memory only), never plaintext.
   */
  attachLocal(local: SealedLocal | null): void;
  discardOutbox(cid: string, id: string): void;
  markRead(cid: string): void;
  deleteMessage(cid: string, id: string): void;
  clearChat(cid: string): void;
  undo(): void;
}

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function createChatStore(port: ChatPort, undoMs: number = UNDO_MS): ChatStore {
  let state: ChatState = { threads: [], status: 'loading', outbox: {}, pending: null };
  const subs = new Set<() => void>();
  let off: (() => void) | undefined;
  let users = 0;
  let uid = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** what to do when the window closes / when Undo is pressed */
  let commit: (() => Promise<void>) | null = null;
  let revert: (() => Promise<void>) | null = null;
  let local: SealedLocal | null = null;
  let offLocal: (() => void) | undefined;
  let offOnline: (() => void) | undefined;
  const inflight = new Set<string>();
  let writes: Promise<unknown> = Promise.resolve();

  const set = (patch: Partial<ChatState>) => {
    state = { ...state, ...patch };
    subs.forEach((f) => f());
  };
  const quiet = (p: Promise<unknown>) => void p.catch(() => undefined);

  function listen() {
    off?.();
    off = port.subscribeThreads(
      uid,
      (threads) => set({ threads, status: 'ready' }),
      () => set({ status: 'error' }),
    );
  }

  /** Close the open window now: the operation becomes final (erase for real). One toast at a time (G9). */
  function settle() {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const c = commit;
    commit = null;
    revert = null;
    if (state.pending) set({ pending: null });
    if (c) quiet(c());
  }

  function open(
    p: Omit<PendingUndo, 'until'>,
    doCommit: () => Promise<void>,
    doRevert: () => Promise<void>,
  ) {
    settle();
    commit = doCommit;
    revert = doRevert;
    set({ pending: { ...p, until: Date.now() + undoMs } });
    timer = setTimeout(settle, undoMs);
  }

  /** Keep the sealed copy of one conversation's outbox in step (fire and forget; a locked vault stores nothing). */
  function persist(cid: string) {
    const l = local;
    if (!l) return;
    const list = (state.outbox[cid] ?? []).slice(-OUTBOX_MAX);
    // one writer at a time, in order: a slow seal must not land after the delete that followed it
    writes = writes.then(async () => {
      await (list.length ? l.set(`outbox:${cid}`, list) : l.remove(`outbox:${cid}`));
    });
  }

  const patchOutbox = (
    cid: string,
    f: (l: readonly OutboxMessage[]) => readonly OutboxMessage[],
  ) => {
    set({ outbox: { ...state.outbox, [cid]: f(state.outbox[cid] ?? []) } });
    persist(cid);
  };

  function transmit(m: OutboxMessage) {
    if (inflight.has(m.id)) return;
    inflight.add(m.id);
    port
      .send(m.cid, { id: m.id, text: m.text, at: m.at, ...(m.body ? { body: m.body } : {}) })
      .then(() => patchOutbox(m.cid, (l) => l.filter((x) => x.id !== m.id)))
      .catch(() =>
        patchOutbox(m.cid, (l) => l.map((x) => (x.id === m.id ? { ...x, state: 'failed' } : x))),
      )
      .finally(() => inflight.delete(m.id));
  }

  /** Bring back what an earlier session left unsent (once the vault has a key) and send it. */
  async function hydrate() {
    const l = local;
    if (!l || !l.ready()) return;
    for (const k of await l.keys('outbox:')) {
      const cid = k.slice('outbox:'.length);
      const saved = await l.get<OutboxMessage[]>(k);
      if (!saved?.length || local !== l) continue;
      const known = new Set((state.outbox[cid] ?? []).map((x) => x.id));
      const fresh = saved
        .filter((x) => x && typeof x.id === 'string' && x.cid === cid && !known.has(x.id))
        .map((x): OutboxMessage => ({ ...x, state: 'sending' }));
      if (!fresh.length) continue;
      patchOutbox(cid, (cur) => [...cur, ...fresh]);
      fresh.forEach(transmit);
    }
  }

  /** The connection is back: everything that failed is sent again (idempotent by id). */
  function flushFailed() {
    for (const [cid, list] of Object.entries(state.outbox)) {
      list
        .filter((x) => x.state === 'failed')
        .forEach((x) => {
          patchOutbox(cid, (cur) =>
            cur.map((y) => (y.id === x.id ? { ...y, state: 'sending' } : y)),
          );
          transmit({ ...x, state: 'sending' });
        });
    }
  }

  return {
    port,
    getState: () => state,
    subscribe(f) {
      subs.add(f);
      return () => void subs.delete(f);
    },
    attachLocal(l) {
      offLocal?.();
      offLocal = undefined;
      local = l;
      if (!l) return;
      void hydrate();
      offLocal = l.subscribe(() => void hydrate());
    },
    retain(u) {
      users++;
      if (users === 1 || !off) {
        uid = u;
        listen();
      }
      if (typeof window !== 'undefined' && !offOnline) {
        window.addEventListener('online', flushFailed);
        offOnline = () => window.removeEventListener('online', flushFailed);
      }
    },
    release() {
      users = Math.max(0, users - 1);
      if (users === 0) {
        off?.();
        off = undefined;
        offOnline?.();
        offOnline = undefined;
        // leaving the chat never cancels a pending erase: it closes the window now
        settle();
      }
    },
    restart() {
      set({ status: 'loading' });
      listen();
    },
    send(cid, text, body) {
      const m: OutboxMessage = {
        id: newId(),
        cid,
        text: text.trim(),
        ...(body ? { body } : {}),
        at: port.now(),
        state: 'sending',
      };
      patchOutbox(cid, (l) => [...l, m]);
      transmit(m);
      return m.id;
    },
    retrySend(cid, id) {
      const m = state.outbox[cid]?.find((x) => x.id === id);
      if (!m) return;
      patchOutbox(cid, (l) => l.map((x) => (x.id === id ? { ...x, state: 'sending' } : x)));
      transmit({ ...m, state: 'sending' });
    },
    discardOutbox(cid, id) {
      patchOutbox(cid, (l) => l.filter((x) => x.id !== id));
    },
    markRead(cid) {
      quiet(port.markRead(cid));
    },
    deleteMessage(cid, id) {
      // hidden for the sender at once; the recipient still sees it until the window closes
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
            async () => undefined, // clearing is a per-user marker: nothing more to erase
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
  };
}

// --- one store per port ------------------------------------------------------------------------------------

const stores = new WeakMap<ChatPort, ChatStore>();
export function chatStoreFor(port: ChatPort): ChatStore {
  let s = stores.get(port);
  if (!s) stores.set(port, (s = createChatStore(port)));
  return s;
}

const adapters = new WeakMap<ChatPort, ConversationsPort>();

/**
 * The nav badges, the chat list and the dock read the SAME conversation snapshot: this adapts the chat store
 * to the `ConversationsPort` the unread hook expects (`useCoachUnread`). Memoised per port, so every reader
 * shares one unread store.
 */
export function conversationsFromChat(port: ChatPort): ConversationsPort {
  let a = adapters.get(port);
  if (a) return a;
  a = {
    subscribe(trainerUid, onDocs) {
      const store = chatStoreFor(port);
      store.retain(trainerUid);
      const push = () =>
        onDocs(
          store.getState().threads.map((t): ConversationUnreadDoc => ({
            cid: t.cid,
            clientId: t.clientId,
            trainerId: trainerUid,
            active: t.active,
            unread: { [trainerUid]: t.unread },
          })),
        );
      const off = store.subscribe(push);
      push();
      return () => {
        off();
        store.release();
      };
    },
  };
  adapters.set(port, a);
  return a;
}

/** Messages of one thread with the outbox merged in (an unsent message shows at the end, in compose order). */
export function mergeOutbox(
  messages: readonly ChatMessage[],
  outbox: readonly OutboxMessage[] = [],
): ChatMessage[] {
  const known = new Set(messages.map((m) => m.id));
  const extra = outbox
    .filter((o) => !known.has(o.id))
    .map((o): ChatMessage => ({
      id: o.id,
      cid: o.cid,
      from: 'trainer',
      at: o.at,
      body: o.body ?? { kind: 'text', text: o.text },
      state: o.state,
    }));
  return [...messages, ...extra].sort((a, b) => a.at - b.at);
}
