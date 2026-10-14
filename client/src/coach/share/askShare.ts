/**
 * "Please share" requests (S-21 ask, Q-11). The trainer cannot see a kind of data the client keeps private; asking
 * sends a REAL chat message whose sealed body is `{kind:'request', reqId:'share-ask:<kind>:<n>'}` through the chat
 * port (fixtures now, the sealed Firestore adapter in production: the message IS the persisted request). Both sides
 * draw it as a card from the kind, in their own language. Repeat asks for the same kind within a day are not sent.
 */
import type { ChatMessage, MsgBody } from '../chat/types';
import { isShareKind, type ShareKind } from './types';

export const ASK_PREFIX = 'share-ask:';
export const ASK_REPEAT_MS = 24 * 3600 * 1000;

export const askBody = (kind: ShareKind, n: number): MsgBody => ({
  kind: 'request',
  reqId: `${ASK_PREFIX}${kind}:${n}`,
});

/** The kind a request id asks for, or null when it is not a share ask (a reschedule request, for example). */
export function parseAskReqId(reqId: string): ShareKind | null {
  if (!reqId.startsWith(ASK_PREFIX)) return null;
  const k = reqId.slice(ASK_PREFIX.length).split(':')[0];
  return isShareKind(k) ? k : null;
}

/** True when the thread already holds a recent ask for this kind from the trainer (no nagging). */
export function askedRecently(
  messages: readonly ChatMessage[],
  kind: ShareKind,
  now: number,
): boolean {
  return messages.some(
    (m) =>
      !m.deleted &&
      m.from === 'trainer' &&
      m.body.kind === 'request' &&
      parseAskReqId(m.body.reqId) === kind &&
      now - m.at < ASK_REPEAT_MS,
  );
}
