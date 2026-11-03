import { useSyncExternalStore } from 'react';
import type { CallSession } from './callSession';
import { IDLE, type CallState } from './callMachine';
import type { CallLogEntry } from './callLog';

/**
 * Where the running `CallSession` is published (SPO-445). The session itself lives in one lazy host mounted at the app
 * root (`CallsHost`); screens that only start a call read it from here, so they never pull the WebRTC code.
 */
interface Published {
  session: CallSession | null;
  /** Calls may be used: signed in, not a manager, and the server switch is on. */
  enabled: boolean;
}

let cur: Published = { session: null, enabled: false };
const subs = new Set<() => void>();
const names = new Map<string, string>();

export function publishCalls(next: Published): void {
  if (cur.session === next.session && cur.enabled === next.enabled) return;
  cur = next;
  subs.forEach((f) => f());
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

export const useCallsPublished = (): Published =>
  useSyncExternalStore(
    subscribe,
    () => cur,
    () => cur,
  );

/** Remember how a person is called, so an incoming call from them can show the name. */
export function rememberPeer(id: string, name: string): void {
  if (id && name) names.set(id, name);
}
export const peerName = (id: string | null): string | undefined => (id ? names.get(id) : undefined);

/** Live call state (idle when there is no session). */
export function useCallState(): CallState {
  const { session } = useCallsPublished();
  return useSyncExternalStore(
    (f) => (session ? session.subscribe(f) : () => {}),
    () => (session ? session.getState() : IDLE),
    () => IDLE,
  );
}

/** A unique client-generated call id (idempotent upsert on the server): 24 url-safe characters. */
export function newCallId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// ---- call log queue: a finished call waits here until the chat of that pair is open and can write the line ----
interface Queued {
  peerId: string;
  callId: string;
  entry: CallLogEntry;
}
const queue: Queued[] = [];
const queueSubs = new Set<() => void>();

export function queueCallLog(q: Queued): void {
  if (queue.some((x) => x.callId === q.callId)) return;
  queue.push(q);
  queueSubs.forEach((f) => f());
}

/** Hand every waiting line of this pair to `write` (once each) and, from then on, new ones as they arrive. */
export function drainCallLogs(
  peerId: string,
  write: (e: CallLogEntry, callId: string) => void,
): () => void {
  const run = () => {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].peerId !== peerId) continue;
      const [q] = queue.splice(i, 1);
      write(q.entry, q.callId);
    }
  };
  run();
  queueSubs.add(run);
  return () => queueSubs.delete(run);
}

// ---- pre-call check: asked for on the first call of a device ----
export interface PreflightRequest {
  peerId: string;
  kind: 'voice' | 'video';
}
let preflight: PreflightRequest | null = null;
const preflightSubs = new Set<() => void>();
export function openPreflight(r: PreflightRequest | null): void {
  preflight = r;
  preflightSubs.forEach((f) => f());
}
export function usePreflight(): PreflightRequest | null {
  return useSyncExternalStore(
    (f) => {
      preflightSubs.add(f);
      return () => preflightSubs.delete(f);
    },
    () => preflight,
    () => null,
  );
}
