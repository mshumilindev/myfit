import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ChatMessage } from '../../chat/types';
import { clientChatStoreFor, mergeClientOutbox } from './chatStore';
import { getClientChatPort } from './config';
import type { ClientChatPort } from './chatPort';
import { useClientCoach } from './useClientCoach';

export type ThreadStatus = 'loading' | 'ready' | 'error';

/** The open thread: messages (outbox merged), unread when it opened, status. The only message listener there is. */
export function useClientThread(cid: string | null, port?: ClientChatPort) {
  const store = clientChatStoreFor(port ?? getClientChatPort());
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [snap, setSnap] = useState<{
    cid: string | null;
    list: ChatMessage[];
    unread: number;
    status: ThreadStatus;
  }>({
    cid: null,
    list: [],
    unread: 0,
    status: 'loading',
  });
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!cid) return;
    return store.port.subscribe(
      cid,
      (d) => setSnap({ cid, list: d.messages, unread: d.unread, status: 'ready' }),
      () =>
        setSnap((s) => ({ cid, list: s.cid === cid ? s.list : [], unread: 0, status: 'error' })),
    );
  }, [store, cid, tries]);
  const mine = snap.cid === cid;
  return {
    store,
    state,
    messages: cid ? mergeClientOutbox(mine ? snap.list : [], state.outbox, cid) : [],
    unread: mine ? snap.unread : 0,
    status: (cid && mine ? snap.status : 'loading') as ThreadStatus,
    retry: () => {
      setSnap((s) => ({ ...s, status: 'loading' }));
      setTries((n) => n + 1);
    },
  };
}

/** Unread messages from my trainer: the ONE number behind the Today tile, the nav badge and the chat divider (R-KIT-23). */
export function useClientUnread(port?: ClientChatPort): number {
  const { snapshot } = useClientCoach();
  const cid = snapshot?.link.state === 'none' ? null : (snapshot?.link.cid ?? null);
  const p = port ?? getClientChatPort();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!cid) return;
    return p.subscribeUnread(cid, setN);
  }, [p, cid]);
  return cid ? n : 0;
}
