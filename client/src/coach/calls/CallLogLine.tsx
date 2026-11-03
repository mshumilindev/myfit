import { useEffect } from 'react';
import { CallLogRow, type CallLogKind } from '../../components/ui/CallLogRow';
import { useCallsT } from '../../i18n/calls';
import { encodeCallLog, parseCallLog, type CallLogEntry } from '../../calls/callLog';
import { drainCallLogs, newCallId, useCallsPublished } from '../../calls/callsStore';
import { clock } from '../chat/format';
import type { MsgBody } from '../chat/types';

export const CALL_MSG_TYPE = 'call';

/** The sealed chat body for a finished call. */
export const callLogBody = (e: CallLogEntry): MsgBody => ({
  kind: 'system',
  type: CALL_MSG_TYPE,
  text: encodeCallLog(e),
});

/** True for the system message a call leaves; `null` entry means a broken one (drawn as nothing). */
export const isCallLog = (b: MsgBody): boolean => b.kind === 'system' && b.type === CALL_MSG_TYPE;

/**
 * One call in the chat history (SPO-445), drawn with the kit `CallLogRow`. `mine`: this device's person made the call.
 * "Call back" shows only when calls are on and nothing else is ringing.
 */
export function CallLogLine({
  text,
  at,
  mine,
  peerId,
}: {
  text: string | undefined;
  at: number;
  mine: boolean;
  peerId: string;
}) {
  const { cl } = useCallsT();
  const { session, enabled } = useCallsPublished();
  const e = parseCallLog(text);
  if (!e) return null;
  const min = Math.max(1, Math.round(e.sec / 60));
  let kind: CallLogKind;
  let label: string;
  switch (e.k) {
    case 'done':
      kind = 'done';
      label = e.video ? cl.callLogVideo(min) : cl.callLogVoice(min);
      break;
    case 'declined':
      kind = 'declined';
      label = cl.callLogDeclined;
      break;
    case 'dropped':
      kind = 'failed';
      label = cl.callLogDropped;
      break;
    default:
      kind = mine ? 'noanswer' : 'missed';
      label = mine ? cl.callLogNoAnswer : e.video ? cl.callLogMissedVideo : cl.callLogMissed;
  }
  const back = enabled && session && kind !== 'done';
  return (
    <CallLogRow
      kind={kind}
      video={e.video}
      text={label}
      time={clock(at)}
      callBackLabel={back ? cl.callBack : undefined}
      onCallBack={
        back ? () => void session.dial(peerId, e.video ? 'video' : 'voice', newCallId()) : undefined
      }
    />
  );
}

/**
 * While this chat is open, write the line of every finished call with this person (the caller's device only). A call that
 * ended while another screen was open waits in the queue and is written when the chat opens.
 */
export function useCallLogWriter(
  peerId: string,
  write: (preview: string, body: MsgBody) => void,
): void {
  const { cl } = useCallsT();
  useEffect(
    () =>
      drainCallLogs(peerId, (e) => {
        const min = Math.max(1, Math.round(e.sec / 60));
        const preview =
          e.k === 'done'
            ? e.video
              ? cl.callLogVideo(min)
              : cl.callLogVoice(min)
            : e.k === 'declined'
              ? cl.callLogDeclined
              : e.k === 'dropped'
                ? cl.callLogDropped
                : cl.callLogNoAnswer;
        write(preview, callLogBody(e));
      }),
    // `write` is re-created on every render by the screens; the queue only needs the pair and the words
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [peerId, cl],
  );
}
