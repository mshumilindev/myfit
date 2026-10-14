import { useEffect, useSyncExternalStore } from 'react';
import { getConversationsPort, getTrainerUid } from './config';
import {
  createUnreadStore,
  NO_UNREAD,
  type CoachUnread,
  type ConversationsPort,
  type UnreadStore,
} from './unreadStore';

interface Entry {
  store: UnreadStore;
  port: ConversationsPort;
  users: number;
}
const entries = new Map<string, Entry>();

/** One store per (uid, port): every badge reads the same counts. Created lazily, started by the first mounted reader. */
function entryFor(port: ConversationsPort, uid: string): Entry {
  const e = entries.get(uid);
  if (e && e.port === port) return e;
  e?.store.stop();
  const fresh: Entry = { store: createUnreadStore(port, uid), port, users: 0 };
  entries.set(uid, fresh);
  return fresh;
}

const retain = (e: Entry): void => {
  e.users++;
};
/** true when the last reader left */
const releaseLast = (e: Entry): boolean => --e.users <= 0;

const EMPTY_STORE: UnreadStore = {
  getState: () => NO_UNREAD,
  subscribe: () => () => undefined,
  start: () => undefined,
  stop: () => undefined,
};

/** Per-client counts and the total. `port` / `uid` are injectable for tests and stories. */
export function useCoachUnreadState(
  opts: { port?: ConversationsPort; uid?: string | null } = {},
): CoachUnread {
  const uid = opts.uid === undefined ? getTrainerUid() : opts.uid;
  const port = opts.port ?? getConversationsPort();
  const entry = uid ? entryFor(port, uid) : null;
  const store = entry?.store ?? EMPTY_STORE;
  useEffect(() => {
    if (!entry) return;
    retain(entry);
    entry.store.start();
    return () => {
      if (releaseLast(entry)) {
        entry.store.stop();
        if (entries.get(uid!) === entry) entries.delete(uid!);
      }
    };
  }, [entry, uid]);
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** Drop-in for the shell: the total for the rail / tab bar Chat badge (0 = no badge). */
export function useCoachUnread(): number {
  return useCoachUnreadState().total;
}
