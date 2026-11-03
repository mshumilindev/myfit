/**
 * Call state machine (SPO-444). Pure: no WebRTC, no Firestore, no timers. The session controller turns
 * server documents and peer-connection events into these events and draws the state.
 */
export type CallKind = 'voice' | 'video';
export type CallRole = 'caller' | 'callee';
export type CallPhase =
  | 'idle'
  | 'ringing-out' // we called, waiting for an answer
  | 'ringing-in' // somebody calls us
  | 'connecting' // answered, media not flowing yet
  | 'active'
  | 'reconnecting' // media dropped, trying again (ICE restart)
  | 'ended';

/** Why a call ended, as the UI shows it. Mirrors the server `endReason` plus local-only causes. */
export type CallEndReason =
  | 'hangup'
  | 'declined'
  | 'missed'
  | 'busy'
  | 'unavailable'
  | 'failed'
  | 'offline'
  | 'no-device'
  | 'permission-denied'
  | 'disabled';

export interface CallState {
  phase: CallPhase;
  callId: string | null;
  peerId: string | null;
  kind: CallKind;
  role: CallRole | null;
  endReason: CallEndReason | null;
  /** Epoch ms when media first flowed; drives the timer. */
  connectedAt: number | null;
  /** Epoch ms when the call ended (set by the session); with `connectedAt` it gives the length. */
  endedAt: number | null;
  micOn: boolean;
  camOn: boolean;
  /** Video fell back to voice because the link is weak. */
  voiceOnly: boolean;
}

export type CallEvent =
  | { type: 'dial'; callId: string; peerId: string; kind: CallKind }
  | { type: 'incoming'; callId: string; peerId: string; kind: CallKind }
  | { type: 'accept' } // callee pressed Answer
  | { type: 'accept-voice' } // callee pressed "voice only"
  | { type: 'remote-answered' }
  | { type: 'connected'; at: number }
  | { type: 'link-lost' }
  | { type: 'link-back' }
  | { type: 'end'; reason: CallEndReason; at?: number } // either side, local or remote
  | { type: 'toggle-mic' }
  | { type: 'toggle-cam' }
  | { type: 'degrade' }
  | { type: 'reset' };

export const IDLE: CallState = {
  phase: 'idle',
  callId: null,
  peerId: null,
  kind: 'voice',
  role: null,
  endReason: null,
  connectedAt: null,
  endedAt: null,
  micOn: true,
  camOn: false,
  voiceOnly: false,
};

/** Ringing window on both sides (the push TTL is the same 45 s). */
export const RING_MS = 45_000;
/** The caller sends `callActive` this often once connected. The server keeps a call alive for 45 s. */
export const HEARTBEAT_MS = 20_000;

export const isLive = (s: CallState): boolean => s.phase !== 'idle' && s.phase !== 'ended';

export function callReducer(s: CallState, e: CallEvent): CallState {
  switch (e.type) {
    case 'reset':
      return IDLE;
    case 'dial':
      if (isLive(s)) return s; // already in a call: the UI says "busy", nothing changes
      return {
        ...IDLE,
        phase: 'ringing-out',
        callId: e.callId,
        peerId: e.peerId,
        kind: e.kind,
        role: 'caller',
        camOn: e.kind === 'video',
      };
    case 'incoming':
      if (isLive(s)) return s;
      return {
        ...IDLE,
        phase: 'ringing-in',
        callId: e.callId,
        peerId: e.peerId,
        kind: e.kind,
        role: 'callee',
        camOn: e.kind === 'video',
      };
    case 'accept':
      return s.phase === 'ringing-in' ? { ...s, phase: 'connecting' } : s;
    case 'accept-voice':
      return s.phase === 'ringing-in'
        ? { ...s, phase: 'connecting', kind: 'voice', camOn: false, voiceOnly: true }
        : s;
    case 'remote-answered':
      return s.phase === 'ringing-out' ? { ...s, phase: 'connecting' } : s;
    case 'connected':
      if (s.phase === 'connecting' || s.phase === 'reconnecting') {
        return { ...s, phase: 'active', connectedAt: s.connectedAt ?? e.at };
      }
      return s;
    case 'link-lost':
      return s.phase === 'active' ? { ...s, phase: 'reconnecting' } : s;
    case 'link-back':
      return s.phase === 'reconnecting' ? { ...s, phase: 'active' } : s;
    case 'end':
      // The first reason wins: a late "failed" must not overwrite "hangup".
      if (!isLive(s)) return s;
      return { ...s, phase: 'ended', endReason: e.reason, endedAt: e.at ?? null, camOn: false };
    case 'toggle-mic':
      return isLive(s) ? { ...s, micOn: !s.micOn } : s;
    case 'toggle-cam':
      return isLive(s) && s.kind === 'video' && !s.voiceOnly ? { ...s, camOn: !s.camOn } : s;
    case 'degrade':
      return (s.phase === 'active' || s.phase === 'reconnecting') && s.kind === 'video'
        ? { ...s, voiceOnly: true, camOn: false }
        : s;
    default:
      return s;
  }
}

/** Seconds since media first flowed (0 before). */
export function elapsedSeconds(s: CallState, now: number): number {
  return s.connectedAt === null ? 0 : Math.max(0, Math.floor((now - s.connectedAt) / 1000));
}
