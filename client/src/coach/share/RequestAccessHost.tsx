import { useClientT } from '../../i18n/coachClient';
import { useChat, useThreadMessages } from '../chat/useChat';
import type { CoachClient } from '../domain/types';
import { firstName } from '../screens/format';
import { accessAskBody, askPause, sharedOf } from './accessAsk';
import { RequestAccessSheet } from './RequestAccessSheet';

/**
 * "Request access" from the client page (SPO-99): the sheet over the client's real thread. The thread is read only while
 * the sheet is open (so it is not a second standing message listener), the ask goes through the chat store (outbox, retry).
 */
export function RequestAccessHost({
  client,
  onClose,
}: {
  client: CoachClient;
  onClose: () => void;
}) {
  const { cc } = useClientT();
  const chat = useChat();
  const thread = chat.threads.find((t) => t.clientId === client.id && t.active);
  const cid = thread?.cid ?? null;
  const { messages } = useThreadMessages(chat.store, cid, chat.outbox);
  const now = chat.store.port.now();
  return (
    <RequestAccessSheet
      first={firstName(client.name)}
      shared={sharedOf(client.consent)}
      noApp={client.mode === 'program'}
      noChat={!cid}
      pause={askPause(messages, now)}
      onSend={(cats) => {
        if (!cid) return;
        chat.store.send(cid, cc.raKind, accessAskBody(cats, now));
        onClose();
      }}
      onClose={onClose}
    />
  );
}
