/**
 * The seam between the client's chat with the trainer and its data. The same message model as the trainer's chat
 * (`coach/chat/types`), seen from the other side: "me" is `from: 'client'`.
 *
 * The real adapter (done): `data/firestore/clientChatPort.ts`, per plan section 10 and Part C:
 *   subscribe       onSnapshot(conversations/{cid}) for `unread[me]` + onSnapshot(messages orderBy at desc limit 50); every
 *                   doc opened with `chatCodec.openChatMessage` (AAD-bound); a failing doc becomes `unverified`.
 *   send            `chatCodec.sealChatMessage` then setDoc(messages/{id}) from the client; offline: queued, state 'sending'.
 *   markRead        conversations/{cid}.readUpTo[me] (own key only).
 *   softDelete ...  the same 8 s tombstone flow as the trainer (R-BE-CHAT-6); clear = per-user `clearedBefore` (R-BE-CHAT-7).
 */
import type { ChatMessage, MsgBody } from '../../chat/types';

export type Unsubscribe = () => void;

export interface ClientThreadData {
  messages: ChatMessage[];
  unread: number;
  clearedBefore: number;
}

export interface ClientChatPort {
  now(): number;
  /** Live thread (messages oldest first, hidden ones already removed). Calls `on` at once with the cache when there is one. */
  subscribe(
    cid: string,
    on: (d: ClientThreadData) => void,
    onError: (e: unknown) => void,
  ): Unsubscribe;
  /** Only the unread number of the conversation (nav badge, Today tile): never opens messages. */
  subscribeUnread(cid: string, on: (n: number) => void): Unsubscribe;
  send(cid: string, draft: { id: string; text: string; at: number; body?: MsgBody }): Promise<void>;
  markRead(cid: string): Promise<void>;
  softDelete(cid: string, id: string): Promise<void>;
  undoDelete(cid: string, id: string): Promise<void>;
  commitDelete(cid: string, id: string): Promise<void>;
  clearChat(cid: string): Promise<{ previous: number }>;
  undoClear(cid: string, previous: number): Promise<void>;
}
