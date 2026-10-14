/**
 * The ONE seam between the chat UI and its data (plan 2.6: components never call Firebase or callables). The
 * fixtures adapter (`fixtures.ts`) and the real adapter implement the same port.
 *
 * The real adapter (done): `data/firestore/chatPort.ts` (sealed, signed, AAD-bound). Per plan section 10 and Part C it does:
 *   subscribeThreads  onSnapshot(conversations where trainerId == uid && active == true)  (the only list query the
 *                     rules allow; the same snapshot feeds the nav badges through `conversationsFromChat`),
 *                     previews decrypted locally from the last message (never stored in the open).
 *   subscribeMessages onSnapshot(conversations/{cid}/messages orderBy at desc limit opts.limit ?? PAGE_SIZE; a bigger limit = the next page; meta.hasMore = the page came back full); every doc opened
 *                     with `chatCodec.openChatMessage` (AAD-bound); a failing doc becomes `unverified`, never text;
 *                     hides at <= clearedBefore[me] and the sender's own `del.state == 'pending'`.
 *   send              seal with `chatCodec.sealChatMessage` then setDoc(messages/{id}) from the client (rules 6.2);
 *                     a trigger maintains lastAt / lastFrom / unread. Offline: queued with state 'sending'.
 *   markRead          update conversations/{cid}.readUpTo[uid] (own key only); functions recompute unread.
 *   softDelete / undoDelete / commitDelete   write `del:{state:'pending',at}`, remove it, or write the tombstone
 *                     (enc removed, deleted:true, deletedAt) at 8 s (R-BE-CHAT-6).
 *   clearChat / undoClear   write clearedBefore[uid] = now and restore the previous value (R-BE-CHAT-7).
 * Every method may reject with PortError-like codes; the store keeps the UI usable (offline, vault locked).
 */
import type { ChatMessage, ChatThread, MsgBody, Unsubscribe } from './types';

/** Messages per page (R-BE-CHAT-4: the open thread listens to the newest 50, older pages are asked for). */
export const PAGE_SIZE = 50;

/** Extra information that comes with a messages snapshot. */
export interface MessagesMeta {
  /** There are older messages than the ones delivered (the user can ask for the next page). */
  hasMore: boolean;
}

export interface ChatPort {
  /** Live list of the trainer's active conversations. Calls `onThreads` at once with the cached list when there is one. */
  subscribeThreads(
    trainerUid: string,
    onThreads: (threads: ChatThread[]) => void,
    onError: (e: unknown) => void,
  ): Unsubscribe;
  /**
   * Live messages of ONE conversation (only the open thread is ever listened to, R-BE-CHAT-4). Oldest first.
   * `opts.limit` is the size of the live window (the newest N messages, default PAGE_SIZE); paging = subscribing
   * again with a larger limit. `meta.hasMore` tells whether older messages exist.
   */
  subscribeMessages(
    cid: string,
    onMessages: (messages: ChatMessage[], meta?: MessagesMeta) => void,
    onError: (e: unknown) => void,
    opts?: { limit?: number },
  ): Unsubscribe;
  /** Idempotent by `id`. */
  send(cid: string, draft: { id: string; text: string; at: number; body?: MsgBody }): Promise<void>;
  /** Sets this user's read marker to "now": the conversation's unread count for this user becomes 0. */
  markRead(cid: string): Promise<void>;
  softDelete(cid: string, id: string): Promise<void>;
  undoDelete(cid: string, id: string): Promise<void>;
  commitDelete(cid: string, id: string): Promise<void>;
  /** Hides everything up to now for this user only; resolves with the previous marker for Undo. */
  clearChat(cid: string): Promise<{ previous: number }>;
  undoClear(cid: string, previous: number): Promise<void>;
  /** Clock (the fixtures adapter pins Wed 7 Oct 2026 09:05). */
  now(): number;
}
