/**
 * The real `ClientChatPort`: the client's thread with the trainer, on top of the same sealed Firestore chat port the
 * trainer uses (`createFirestoreChatPort`, side `client`). This adapter only adds what the client screens need beside
 * the messages: the unread number and the `clearedBefore` marker of the conversation document (both open fields that
 * the functions maintain). Nothing is opened or logged here.
 */
import type { ChatPort } from '../../chat/port';
import type { ClientChatPort, ClientThreadData } from '../../client/data/chatPort';
import type { FsApi, Raw } from './fsApi';

export function createFirestoreClientChatPort(d: {
  fs: FsApi;
  chat: ChatPort;
  uid: string;
}): ClientChatPort {
  const { fs, chat, uid } = d;
  const unreadOf = (c: Raw | null) =>
    Number((c?.unread as Record<string, number> | undefined)?.[uid] ?? 0);
  const clearedOf = (c: Raw | null) =>
    Number((c?.clearedBefore as Record<string, number> | undefined)?.[uid] ?? 0);
  return {
    now: () => fs.now(),
    subscribe(cid, on, onError) {
      let conv: Raw | null = null;
      let messages: ClientThreadData['messages'] | null = null;
      const emit = () => {
        if (messages) on({ messages, unread: unreadOf(conv), clearedBefore: clearedOf(conv) });
      };
      const offDoc = fs.listenDoc(
        `conversations/${cid}`,
        (c) => {
          conv = c;
          emit();
        },
        onError,
      );
      const offMsgs = chat.subscribeMessages(
        cid,
        (m) => {
          messages = m;
          emit();
        },
        onError,
      );
      return () => {
        offDoc();
        offMsgs();
      };
    },
    subscribeUnread(cid, on) {
      return fs.listenDoc(
        `conversations/${cid}`,
        (c) => on(unreadOf(c)),
        () => undefined,
      );
    },
    send: (cid, draft) => chat.send(cid, draft),
    markRead: (cid) => chat.markRead(cid),
    softDelete: (cid, id) => chat.softDelete(cid, id),
    undoDelete: (cid, id) => chat.undoDelete(cid, id),
    commitDelete: (cid, id) => chat.commitDelete(cid, id),
    clearChat: (cid) => chat.clearChat(cid),
    undoClear: (cid, previous) => chat.undoClear(cid, previous),
  };
}
