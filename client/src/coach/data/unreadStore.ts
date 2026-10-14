/**
 * Unread messages across the coach's clients: the ONE source for the rail Chat badge, the phone tab bar Chat
 * badge and the dock FAB (R-FE-011, R-FE-102). Reads the open `unread{<uid>: n}` map of
 * `conversations/{cid}` (maintained by functions, R-BE-CHAT-3) for conversations where `trainerId == uid`
 * and `active == true` (the only list query the rules allow). Admin = coach: same query with the admin's uid.
 */
export interface CoachUnread {
  total: number;
  byClient: Readonly<Record<string, number>>;
}

/** The slice of a conversation document this module reads (open fields only, no content). */
export interface ConversationUnreadDoc {
  cid: string;
  clientId: string;
  trainerId: string;
  active: boolean;
  unread?: Record<string, number>;
}

export interface ConversationsPort {
  /** Live list of the trainer's active conversations. Returns the unsubscribe. */
  subscribe(
    trainerUid: string,
    onDocs: (docs: ConversationUnreadDoc[]) => void,
    onError: (e: unknown) => void,
  ): () => void;
}

/** Total of per-client counts (negative / non-finite entries count as 0, fractions floor). */
export function sumUnread(byClient: Readonly<Record<string, number>>): number {
  let total = 0;
  for (const n of Object.values(byClient)) if (Number.isFinite(n) && n > 0) total += Math.floor(n);
  return total;
}

export const NO_UNREAD: CoachUnread = Object.freeze({ total: 0, byClient: Object.freeze({}) });

/** Per-client counts for ONE trainer. Ignores ended and foreign conversations and junk values. */
export function unreadFromConversations(
  trainerUid: string,
  docs: readonly ConversationUnreadDoc[],
): CoachUnread {
  const byClient: Record<string, number> = {};
  for (const d of docs) {
    if (!d || d.trainerId !== trainerUid || d.active !== true || !d.clientId) continue;
    const n = d.unread?.[trainerUid];
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) continue;
    byClient[d.clientId] = (byClient[d.clientId] ?? 0) + Math.floor(n);
  }
  return { total: sumUnread(byClient), byClient };
}

export interface UnreadStore {
  getState(): CoachUnread;
  subscribe(f: () => void): () => void;
  start(): void;
  stop(): void;
}

/** Never throws, never blocks: until the first snapshot (or on error / offline) the state is 0 = no badge. */
export function createUnreadStore(port: ConversationsPort, trainerUid: string | null): UnreadStore {
  let state: CoachUnread = NO_UNREAD;
  const subs = new Set<() => void>();
  let off: (() => void) | undefined;
  const set = (s: CoachUnread) => {
    if (s.total === state.total && JSON.stringify(s.byClient) === JSON.stringify(state.byClient))
      return;
    state = s;
    subs.forEach((f) => f());
  };
  return {
    getState: () => state,
    subscribe(f) {
      subs.add(f);
      return () => void subs.delete(f);
    },
    start() {
      if (off || !trainerUid) return;
      off = port.subscribe(
        trainerUid,
        (docs) => set(unreadFromConversations(trainerUid, docs)),
        () => {
          /* keep the last known counts; a listener error must not blank or block the shell */
        },
      );
    },
    stop() {
      off?.();
      off = undefined;
    },
  };
}
