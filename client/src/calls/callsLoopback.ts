import { browserCallDevices } from './callsFirebase';
import type {
  CallApi,
  CallDevices,
  CallDoc,
  CallError,
  CallWire,
  RemoteCandidate,
  Unsubscribe,
} from './callPorts';

/**
 * E2E-only calls "server" (SPO-434). It exists ONLY in the fixtures build (`VITE_COACH_BACKEND=fixtures`, see
 * CallsHost: in every other build the branch that calls it is dead code and this module is dropped), and even there it
 * does nothing unless the Playwright test exposed the `__callsRpc` binding.
 *
 * The contract logic (pair, busy, unavailable, declined/missed/failed, answer -> active, ICE) lives in Node, in
 * `tests/e2e/calls-server.ts`, behind that binding; this file is the thin CallApi/CallWire adapter over it. Two pages
 * of one browser context sit on two origins (127.0.0.1 and localhost) so each keeps its own localStorage, session and
 * role; the signalling between them can therefore not go through a shared storage, it goes through the test process.
 * The media is real WebRTC between the two pages (Chromium fake devices), without STUN/TURN (host candidates only).
 */
type Reply = { ok: true; v: unknown } | { ok: false; code?: string; reason?: string };
type Rpc = (name: string, args: unknown) => Promise<Reply>;

/** What the test can poke at: the local end of the link. Present only in the fixtures build. */
export interface CallsE2EHook {
  /** Make this page's peer connection report a lost link (`disconnected`, or `failed` straight away). */
  dropLink(state?: 'disconnected' | 'failed'): boolean;
  /** Undo `dropLink('disconnected')`: the real connection state is reported again. */
  restoreLink(): boolean;
  /** Current state of this page's peer connection, for the test to wait on. */
  peerState(): string | null;
  /** What actually arrived over the wire on this page (inbound RTP bytes by kind), and what plays out loud. */
  media(): Promise<{
    audioBytes: number;
    videoBytes: number;
    audioTracks: number;
    videoTracks: number;
  }>;
  /** What this page sends: one entry per sender track (`enabled` false = muted / camera off). */
  senders(): { kind: string; enabled: boolean; live: boolean }[];
}

declare global {
  interface Window {
    __callsRpc?: Rpc;
    __callsE2E?: CallsE2EHook;
  }
}

const POLL_MS = 100;

export interface LoopbackPorts {
  api: CallApi;
  wire: CallWire;
  devices: CallDevices;
}

let ports: LoopbackPorts | null | undefined;

/** The loopback ports, or null when this page has no e2e binding (an ordinary fixtures page keeps the Firebase ones). */
export function loopbackPorts(): LoopbackPorts | null {
  if (ports !== undefined) return ports;
  const rpc = typeof window === 'undefined' ? undefined : window.__callsRpc;
  if (!rpc) return (ports = null);

  const ask = async <T>(name: string, args: unknown): Promise<T> => {
    const r = await rpc(name, args);
    if (r.ok) return r.v as T;
    const err: CallError = new Error(r.reason ?? r.code ?? 'call failed');
    err.code = r.code;
    err.reason = r.reason;
    throw err;
  };

  /** Poll until stopped; each tick may emit. Recursive timeout (not an interval) so a stalled call never piles up. */
  const poll = (tick: () => Promise<void>): Unsubscribe => {
    let stop = false;
    const run = async () => {
      if (stop) return;
      try {
        await tick();
      } catch {
        /* the next tick retries */
      }
      if (!stop) setTimeout(run, POLL_MS);
    };
    void run();
    return () => {
      stop = true;
    };
  };

  const uid = () => localStorage.getItem('spotter.uid') ?? '';

  const api: CallApi = {
    start: (a) => ask('start', { uid: uid(), ...a }),
    answer: (a) => ask('answer', { uid: uid(), ...a }),
    active: (callId) => ask('active', { uid: uid(), callId }),
    end: (callId, reason) => ask('end', { uid: uid(), callId, reason }),
    ice: (callId, candidate) => ask('ice', { uid: uid(), callId, candidate }),
    turn: (callId) => ask('turn', { uid: uid(), callId }),
  };

  const wire: CallWire = {
    watchCall: (callId, cb) => {
      let last: string | undefined;
      return poll(async () => {
        const d = await ask<CallDoc | null>('getCall', { uid: uid(), callId });
        const key = JSON.stringify(d);
        if (key === last) return;
        last = key;
        cb(d);
      });
    },
    watchIce: (callId, myUid, cb) => {
      let after = 0;
      return poll(async () => {
        const items = await ask<{ n: number; candidate: RTCIceCandidateInit }[]>('ice-since', {
          uid: myUid,
          callId,
          after,
        });
        for (const it of items) {
          after = Math.max(after, it.n);
          const c: RemoteCandidate = { id: String(it.n), candidate: it.candidate };
          cb(c);
        }
      });
    },
    watchIncoming: (myUid, cb) => {
      const seen = new Set<string>();
      return poll(async () => {
        const docs = await ask<CallDoc[]>('incoming', { uid: myUid });
        for (const d of docs) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          cb(d);
        }
      });
    },
  };

  let pc: RTCPeerConnection | null = null;
  let forced: RTCPeerConnectionState | null = null;
  const devices: CallDevices = {
    getMedia: browserCallDevices.getMedia,
    // No STUN/TURN in the sandbox: both pages find each other on host candidates.
    createPeer: (config) => {
      const p = new RTCPeerConnection({ ...config, iceServers: [] });
      const set = p.setConfiguration.bind(p);
      p.setConfiguration = (c) => set({ ...c, iceServers: [] });
      pc = p;
      forced = null;
      return p;
    },
    online: () => navigator.onLine,
    now: () => Date.now(),
  };

  const report = (state: RTCPeerConnectionState | null) => {
    if (!pc) return false;
    forced = state;
    if (state)
      Object.defineProperty(pc, 'connectionState', { configurable: true, get: () => forced });
    else delete (pc as { connectionState?: unknown }).connectionState;
    pc.dispatchEvent(new Event('connectionstatechange'));
    return true;
  };

  window.__callsE2E = {
    dropLink: (state = 'failed') => report(state),
    restoreLink: () => report(null),
    peerState: () => (pc ? pc.connectionState : null),
    senders: () =>
      pc
        ? pc
            .getSenders()
            .filter((x) => x.track)
            .map((x) => ({
              kind: (x.track as MediaStreamTrack).kind,
              enabled: (x.track as MediaStreamTrack).enabled,
              live: (x.track as MediaStreamTrack).readyState === 'live',
            }))
        : [],
    media: async () => {
      const out = { audioBytes: 0, videoBytes: 0, audioTracks: 0, videoTracks: 0 };
      if (!pc) return out;
      for (const r of pc.getReceivers()) {
        if (r.track.kind === 'audio') out.audioTracks++;
        else out.videoTracks++;
      }
      (await pc.getStats()).forEach(
        (st: { type?: string; kind?: string; bytesReceived?: number }) => {
          if (st.type !== 'inbound-rtp') return;
          if (st.kind === 'audio') out.audioBytes += st.bytesReceived ?? 0;
          else out.videoBytes += st.bytesReceived ?? 0;
        },
      );
      return out;
    },
  };

  return (ports = {
    api,
    wire,
    devices,
  });
}
