import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { getChatPort, getTrainerUid } from '../data/config';
import { PAGE_SIZE, type ChatPort } from './port';
import { getSealedLocal, isLocalConfigured } from './sealedLocal';
import { chatStoreFor, mergeOutbox, type ChatState, type ChatStore } from './chatStore';
import type { ChatMessage } from './types';

export interface ChatApi extends ChatState {
  store: ChatStore;
}

/**
 * The conversation list + outbox + pending undo. Retains the shared thread listener while mounted. `port` / `uid`
 * are injectable (tests, stories, the real adapter).
 */
export function useChat(opts: { port?: ChatPort; uid?: string | null } = {}): ChatApi {
  const port = opts.port ?? getChatPort();
  const uid = opts.uid === undefined ? getTrainerUid() : opts.uid;
  const store = chatStoreFor(port);
  useEffect(() => {
    if (!uid) return;
    store.retain(uid);
    return () => store.release();
  }, [store, uid]);
  // sealed on-device outbox (Part C.2 no. 9); not where there is no IndexedDB (tests) unless one is configured
  useEffect(() => {
    let off = false;
    if (!hasLocalStorage()) return;
    void getSealedLocal()
      .then((l) => !off && store.attachLocal(l))
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, [store]);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return { ...state, store };
}

/** True when a sealed store can exist here (IndexedDB present, or one was configured by a test / story). */
function hasLocalStorage(): boolean {
  return typeof indexedDB !== 'undefined' || isLocalConfigured();
}

export type MessagesStatus = 'loading' | 'ready' | 'error';

export interface ThreadMessages {
  messages: ChatMessage[];
  status: MessagesStatus;
  retry: () => void;
  /** Older messages exist than the window shows. */
  hasMore: boolean;
  /** An older page was asked for and has not arrived yet. */
  loadingMore: boolean;
  /** Ask for the next page (PAGE_SIZE older messages). */
  loadMore: () => void;
}

/**
 * Messages of the open thread (the only message listener there is, R-BE-CHAT-4), outbox merged. The live window is
 * the newest `limit` messages; `loadMore` widens it by one page (the adapter re-subscribes) and the list stays
 * on screen while the larger window loads.
 */
export function useThreadMessages(
  store: ChatStore,
  cid: string | null,
  outbox: ChatState['outbox'],
): ThreadMessages {
  const [snap, setSnap] = useState<{
    cid: string | null;
    list: ChatMessage[];
    status: MessagesStatus;
    hasMore: boolean;
  }>({
    cid: null,
    list: [],
    status: 'loading',
    hasMore: false,
  });
  const [tries, setTries] = useState(0);
  const [lim, setLim] = useState<{ cid: string | null; n: number; asked: number }>({
    cid: null,
    n: PAGE_SIZE,
    asked: 0,
  });
  const limit = lim.cid === cid ? lim.n : PAGE_SIZE;
  const asked = lim.cid === cid ? lim.asked : 0;
  useEffect(() => {
    if (!cid) return;
    return store.port.subscribeMessages(
      cid,
      (list, meta) => setSnap({ cid, list, status: 'ready', hasMore: meta?.hasMore ?? false }),
      () => setSnap((s) => ({ ...s, cid, list: s.cid === cid ? s.list : [], status: 'error' })),
      { limit },
    );
  }, [store, cid, tries, limit]);
  const retry = useCallback(() => {
    setSnap((s) => ({ ...s, status: 'loading' }));
    setTries((n) => n + 1);
  }, []);
  const loadMore = useCallback(() => {
    setLim((l) => {
      const base = l.cid === cid ? l.n : PAGE_SIZE;
      return { cid, n: base + PAGE_SIZE, asked: l.cid === cid ? l.asked + 1 : 1 };
    });
  }, [cid]);
  const mine = snap.cid === cid;
  const list = mine ? snap.list : [];
  // a page was asked for when the window is bigger than what has been delivered
  const loadingMore = mine && asked > 0 && snap.list.length < limit && snap.hasMore;
  return {
    messages: cid ? mergeOutbox(list, outbox[cid]) : [],
    status: cid && mine ? snap.status : 'loading',
    retry,
    hasMore: mine && snap.hasMore,
    loadingMore,
    loadMore,
  };
}
