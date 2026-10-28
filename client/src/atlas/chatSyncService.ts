/**
 * The Atlas chat in the account (SPO-392): the controller. It holds no Firebase — everything it touches comes in through
 * `HistoryPorts` (the Firestore wiring is `chatSyncPorts.ts`), so it is tested with fakes. Runs only while the global flag
 * `atlasHistory` is on AND the person has the `atlas-history` consent (decided by the host that starts it).
 *
 * - account → device: the account's messages are merged into the chat (`mergeChat`); the device's own stay.
 * - device → account: each local edit (new, changed, removed message) is written as one sealed document; clearing the chat
 *   sets a watermark `clearedAt` (so a device that was offline cannot bring the cleared messages back) and deletes them.
 * - Old messages beyond the window of 100 are deleted from the account by the device that sees them.
 * - Nothing here is ever sent to an AI: the chat history is not part of any AI request.
 */
import {
  ATLAS_WINDOW,
  EMPTY_STATE,
  mergeChat,
  missingRemote,
  type AtlasState,
} from './chatSyncCore';
import type { ChatEdit, ChatMsg } from './chatLog';

export interface HistoryPorts {
  /** Messages in the account (decrypted, newest window). `locked > 0` = the vault is locked: NOT "no messages". */
  watchDocs(apply: (items: ChatMsg[], info: { locked: number }) => void): () => void;
  /** The clear-history watermark (`0` = never cleared). */
  watchState(apply: (st: AtlasState, info: { locked: number }) => void): () => void;
  put(m: ChatMsg): Promise<void>;
  del(id: string): Promise<void>;
  deleteAll(): Promise<void>;
  putState(st: AtlasState): Promise<void>;
  getLocal(): ChatMsg[];
  replaceLocal(next: ChatMsg[]): void;
  onLocalEdit(fn: (e: ChatEdit) => void): () => void;
  now(): number;
  onError(e: unknown): void;
}

export interface AtlasHistory {
  stop(): void;
  /** Sends the messages this device has and the account does not (only on the person's explicit yes). Returns the count. */
  uploadLocal(): Promise<number>;
  /** Deletes the account copy (consent withdrawn). The chat on this device stays. */
  deleteRemote(): Promise<void>;
}

export function startAtlasHistory(p: HistoryPorts): AtlasHistory {
  let remote: ChatMsg[] = [];
  let st: AtlasState = EMPTY_STATE;
  // The newest message time seen so far (here or in the account). The clear-history watermark is this, never the device
  // clock: a clock that runs ahead must not hide messages other devices write later.
  let seenMax = p.getLocal().reduce((n, m) => Math.max(n, m.at), 0);
  const see = (ms: ChatMsg[]) => {
    for (const m of ms) seenMax = Math.max(seenMax, m.at);
  };
  let docsReady = false;
  let stopped = false;
  // Resolves on the first full read of the account's chat: an upload decides what is missing only after that.
  let openReady!: () => void;
  const firstRead = new Promise<void>((r) => (openReady = r));

  const guard = <T>(f: () => Promise<T>): void => {
    f().catch(p.onError);
  };

  const refresh = () => {
    if (stopped || !docsReady) return;
    const next = mergeChat(p.getLocal(), remote, st.clearedAt);
    const cur = p.getLocal();
    const same =
      next.length === cur.length &&
      next.every((m, i) => m === cur[i] || JSON.stringify(m) === JSON.stringify(cur[i]));
    if (!same) p.replaceLocal(next);
  };

  const offDocs = p.watchDocs((items, { locked }) => {
    if (stopped) return;
    remote = [...items].sort((a, b) => a.at - b.at);
    see(remote);
    docsReady = true;
    if (!locked) openReady();
    // Trim the account to the window — never while the vault is locked (a locked read is not a full read).
    if (!locked && remote.length > ATLAS_WINDOW) {
      for (const m of remote.slice(0, remote.length - ATLAS_WINDOW)) guard(() => p.del(m.id));
    }
    refresh();
  });
  const offState = p.watchState((incoming, { locked }) => {
    if (stopped) return;
    st = {
      clearedAt: Math.max(st.clearedAt, incoming.clearedAt),
      withdrawnAt: incoming.withdrawnAt,
    };
    // The consent is on again, so a kept copy is live again: the withdrawal mark goes.
    if (st.withdrawnAt !== null && !locked) {
      st = { ...st, withdrawnAt: null };
      guard(() => p.putState(st));
    }
    refresh();
  });

  const offEdit = p.onLocalEdit((e) => {
    if (stopped) return;
    if (e.cleared) {
      if (seenMax > 0) {
        st = { ...st, clearedAt: Math.max(st.clearedAt, seenMax) };
        guard(() => p.putState(st));
      }
      remote = [];
      guard(() => p.deleteAll());
      return;
    }
    see(e.upsert);
    for (const m of e.upsert) guard(() => p.put(m));
    for (const id of e.removed) guard(() => p.del(id));
  });

  return {
    stop() {
      stopped = true;
      openReady();
      offDocs();
      offState();
      offEdit();
    },
    async uploadLocal() {
      await firstRead;
      if (stopped) return 0;
      const have = new Set(remote.map((m) => m.id));
      const todo = missingRemote(p.getLocal(), have);
      for (const m of todo) await p.put(m);
      return todo.length;
    },
    async deleteRemote() {
      await p.deleteAll();
      remote = [];
    },
  };
}
