import type { CallEndReason, CallState } from './callMachine';

/**
 * The line a finished call leaves in the chat (SPO-445). It is an ordinary sealed chat message of body kind `system` and
 * type `call`; `text` carries this small JSON. The caller's device writes it once, so the pair sees one line.
 */
export interface CallLogEntry {
  v: 1;
  /** done: it took place · declined · noanswer: nobody picked up · dropped: the connection broke */
  k: 'done' | 'declined' | 'noanswer' | 'dropped';
  video: boolean;
  /** Length in seconds (done only). */
  sec: number;
}

export const CALL_LOG_TYPE = 'call';

/**
 * What a call that just ended should leave in the chat, or null for nothing. Quiet hours (`unavailable`), a busy line,
 * being offline and local permission problems leave nothing: the other person never learns an attempt was made.
 */
export function callLogFor(s: CallState): CallLogEntry | null {
  if (s.phase !== 'ended' || s.role !== 'caller' || !s.endReason) return null;
  const video = s.kind === 'video' || s.voiceOnly;
  const sec =
    s.connectedAt !== null && s.endedAt !== null
      ? Math.max(0, Math.round((s.endedAt - s.connectedAt) / 1000))
      : 0;
  const r: CallEndReason = s.endReason;
  if (s.connectedAt !== null && (r === 'hangup' || r === 'declined')) {
    return { v: 1, k: 'done', video: s.kind === 'video', sec };
  }
  if (s.connectedAt !== null && r === 'failed') return { v: 1, k: 'dropped', video, sec };
  if (r === 'declined') return { v: 1, k: 'declined', video: s.kind === 'video', sec: 0 };
  if (r === 'missed') return { v: 1, k: 'noanswer', video: s.kind === 'video', sec: 0 };
  return null;
}

export const encodeCallLog = (e: CallLogEntry): string => JSON.stringify(e);

export function parseCallLog(text: string | undefined): CallLogEntry | null {
  if (!text) return null;
  try {
    const o = JSON.parse(text) as Partial<CallLogEntry>;
    if (o.v !== 1 || typeof o.video !== 'boolean' || typeof o.sec !== 'number') return null;
    if (o.k !== 'done' && o.k !== 'declined' && o.k !== 'noanswer' && o.k !== 'dropped')
      return null;
    return { v: 1, k: o.k, video: o.video, sec: Math.max(0, Math.floor(o.sec)) };
  } catch {
    return null;
  }
}
