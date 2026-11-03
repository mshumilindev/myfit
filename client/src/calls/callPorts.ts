import type { CallEndReason, CallKind } from './callMachine';

/** What the server keeps for one call (docs/specs/SPO-22-calls-contract.md). Only the fields the client reads. */
export interface CallDoc {
  id: string;
  callerId: string;
  calleeId: string;
  kind: CallKind;
  state: 'ringing' | 'answered' | 'active' | 'ended';
  endReason?: string;
  offer?: { type: 'offer'; sdp: string };
  answer?: { type: 'answer'; sdp: string };
  createdAt: number;
}

export interface RemoteCandidate {
  id: string;
  candidate: RTCIceCandidateInit;
}

export type StartResult =
  { state: 'ringing' } | { state: 'ended'; endReason: 'unavailable' | 'busy' };

/** The Cloud Functions (callables). Errors are thrown as `{ code, reason }` by the adapter. */
export interface CallApi {
  start(a: {
    callId: string;
    peerId: string;
    kind: CallKind;
    offer: { type: 'offer'; sdp: string };
    relayOnly: boolean;
  }): Promise<StartResult>;
  answer(a: {
    callId: string;
    accept: boolean;
    answer?: { type: 'answer'; sdp: string };
  }): Promise<void>;
  active(callId: string): Promise<void>;
  end(callId: string, reason: 'hangup' | 'declined' | 'missed' | 'failed'): Promise<void>;
  ice(callId: string, candidate: RTCIceCandidateInit): Promise<void>;
  turn(callId: string): Promise<{ iceServers: RTCIceServer[] }>;
}

export type Unsubscribe = () => void;

/** Firestore side: documents the server writes, read-only for the client. */
export interface CallWire {
  watchCall(callId: string, cb: (doc: CallDoc | null) => void): Unsubscribe;
  /** Candidates written by the other side only. */
  watchIce(callId: string, myUid: string, cb: (c: RemoteCandidate) => void): Unsubscribe;
  /** Calls that ring this user right now. */
  watchIncoming(uid: string, cb: (doc: CallDoc) => void): Unsubscribe;
}

/** Everything the browser provides, injectable so the logic runs in tests without WebRTC. */
export interface CallDevices {
  getMedia(kind: CallKind): Promise<MediaStream>;
  createPeer(config: RTCConfiguration): RTCPeerConnection;
  online(): boolean;
  now(): number;
}

export interface CallError extends Error {
  code?: string;
  reason?: string;
}

/** Server `endReason` (or a callable error reason) to the reason the UI shows. */
export function endReasonFromServer(r: string | undefined): CallEndReason {
  switch (r) {
    case 'declined':
    case 'missed':
    case 'busy':
    case 'unavailable':
    case 'hangup':
    case 'failed':
      return r;
    default:
      return 'failed';
  }
}

/** getUserMedia failure to an end reason (no server call is made in that case). */
export function endReasonFromMediaError(e: unknown): CallEndReason {
  const name = (e as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission-denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-device';
  return 'failed';
}
