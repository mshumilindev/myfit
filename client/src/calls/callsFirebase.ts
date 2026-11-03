import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { mediaConstraints, readCallPrefs } from './callPrefs';
import type { CallDoc, CallApi, CallDevices, CallError, CallWire } from './callPorts';

const call = <I, O>(name: string) => {
  const fn = httpsCallable<I, O>(functions, name);
  return async (data: I): Promise<O> => {
    try {
      return (await fn(data)).data;
    } catch (e) {
      const raw = e as { code?: string; details?: { reason?: string }; message?: string };
      const err: CallError = new Error(raw.message ?? 'call failed');
      err.code = raw.code?.replace(/^functions\//, '');
      err.reason = raw.details?.reason;
      throw err;
    }
  };
};

const callStart = call<Parameters<CallApi['start']>[0], Awaited<ReturnType<CallApi['start']>>>(
  'callStart',
);
const callAnswer = call<Parameters<CallApi['answer']>[0], unknown>('callAnswer');
const callActive = call<{ callId: string }, unknown>('callActive');
const callEnd = call<{ callId: string; reason: string }, unknown>('callEnd');
const callIce = call<{ callId: string; candidate: RTCIceCandidateInit }, unknown>('callIce');
const callTurn = call<{ callId: string }, { iceServers: RTCIceServer[] }>('callTurn');

export const firebaseCallApi: CallApi = {
  start: callStart,
  answer: async (a) => void (await callAnswer(a)),
  active: async (callId) => void (await callActive({ callId })),
  end: async (callId, reason) => void (await callEnd({ callId, reason })),
  ice: async (callId, candidate) => void (await callIce({ callId, candidate })),
  turn: (callId) => callTurn({ callId }),
};

const toDoc = (
  s: QueryDocumentSnapshot<DocumentData> | { id: string; data(): DocumentData | undefined },
) => ({ id: s.id, ...(s.data() as Omit<CallDoc, 'id'>) }) as CallDoc;

/** A ringing call older than this is the server's problem (it closes it as missed), not something to ring for. */
const FRESH_MS = 60_000;

export const firebaseCallWire: CallWire = {
  watchCall: (callId, cb) =>
    onSnapshot(
      doc(db, 'calls', callId),
      (s) => cb(s.exists() ? toDoc(s) : null),
      () => cb(null),
    ),
  watchIce: (callId, myUid, cb) =>
    onSnapshot(
      collection(db, 'calls', callId, 'ice'),
      (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type !== 'added') continue;
          const d = ch.doc.data() as { from?: string; candidate?: RTCIceCandidateInit };
          if (d.from && d.from !== myUid && d.candidate)
            cb({ id: ch.doc.id, candidate: d.candidate });
        }
      },
      () => {},
    ),
  watchIncoming: (uid, cb) =>
    onSnapshot(
      query(collection(db, 'calls'), where('calleeId', '==', uid), where('state', '==', 'ringing')),
      (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type !== 'added') continue;
          const d = toDoc(ch.doc);
          if (Date.now() - d.createdAt < FRESH_MS) cb(d);
        }
      },
      () => {},
    ),
};

export const browserCallDevices: CallDevices = {
  getMedia: (kind) => navigator.mediaDevices.getUserMedia(mediaConstraints(kind, readCallPrefs())),
  createPeer: (config) => new RTCPeerConnection(config),
  online: () => navigator.onLine,
  now: () => Date.now(),
};
