/**
 * Coach chat domain types (M4). Plain data, no display strings (copy lives in i18n), times are epoch ms.
 * Shapes follow plan section 10.1 / Part C: the open fields below are what rules and queries may read, the
 * message `body` is what lives inside the sealed envelope.
 */

/** Characters in one message (R-BE-CHAT-1). */
export const MAX_TEXT = 2000;
/** The soft-delete / clear window (decision 11: 8 s). */
export const UNDO_MS = 8000;

export type MsgFrom = 'trainer' | 'client' | 'system';

/**
 * The decrypted content of a message. `share` / `request` are M5 / M6 cards: their payloads are opaque here and
 * drawn through the `renderCard` slot of ThreadView; without a renderer they show as "Unsupported message".
 * There is no attachment field anywhere (text only).
 */
export type MsgBody =
  | { kind: 'text'; text: string }
  | { kind: 'system'; type: string; text?: string }
  | { kind: 'share'; share: unknown; text?: string }
  | { kind: 'request'; reqId: string; cats?: string[] }
  | { kind: 'request-reply'; reqId: string; result: string }
  | { kind: 'unsupported' };

export type SendState = 'sent' | 'sending' | 'failed';

export interface ChatMessage {
  id: string;
  cid: string;
  from: MsgFrom;
  /** compose / server time, ms (rounded to the second by the sender) */
  at: number;
  body: MsgBody;
  /** tombstone: `enc` is gone, only the line "X deleted a message" remains */
  deleted?: boolean;
  /** authentication of the envelope failed: never shows text (C.2 no. 6/7) */
  unverified?: boolean;
  state: SendState;
}

/** One conversation as the list needs it. `preview` is decrypted locally from the last message. */
export interface ChatThread {
  cid: string;
  clientId: string;
  active: boolean;
  lastAt: number | null;
  lastFrom: MsgFrom | null;
  preview: string | null;
  /** unread messages for THIS user (open `unread{uid}` map) */
  unread: number;
  /** the user's own `clearedBefore` marker (messages with at <= this are hidden) */
  clearedBefore: number;
}

export type Unsubscribe = () => void;

/** What the chat store tells the screens about a pending undoable operation (one at a time, G9). */
export interface PendingUndo {
  kind: 'message' | 'chat';
  cid: string;
  /** message id for kind 'message' */
  id?: string;
  /** when the window closes (ms, store clock) */
  until: number;
}
