/**
 * In-process stand-in for the calls Cloud Functions + `calls/*` documents, for the calls e2e (SPO-434). Not a spec.
 * It follows docs/specs/SPO-22-calls-contract.md: one pair (trainer <-> client), one live call per person (`busy` /
 * `already-in-call`), quiet hours = `unavailable` with nothing written, idempotent `callStart`, answer -> active
 * heartbeat, the first end reason stays, ICE only while the call lives, no TURN. The page talks to it through the
 * `__callsRpc` binding (client/src/calls/callsLoopback.ts).
 */
import type { BrowserContext } from '@playwright/test';

export interface PairIds {
  trainer: { uid: string; key: string };
  client: { uid: string; key: string };
}

/** The ids the fixtures screens use: the client sees the trainer as `trainer-iryna`; `client.key` is what the trainer's side is shown as. */
export const PAIR: PairIds = {
  trainer: { uid: 'e2e-trainer', key: 'trainer-iryna' },
  client: { uid: 'e2e-member', key: 'c1' },
};

type Kind = 'voice' | 'video';
interface Doc {
  id: string;
  callerId: string;
  calleeId: string;
  kind: Kind;
  state: 'ringing' | 'answered' | 'active' | 'ended';
  endReason?: string;
  offer?: unknown;
  answer?: unknown;
  createdAt: number;
  lastSeenAt?: number;
}
interface Fail {
  code: string;
  reason: string;
}
const fail = (code: string, reason: string): never => {
  throw { code, reason } satisfies Fail;
};

export class CallsServer {
  readonly calls = new Map<string, Doc>();
  private readonly ice = new Map<string, { n: number; from: string; candidate: unknown }[]>();
  /** Everything the pages asked for, in order: `[uid, method]`. Tests assert on it (idempotence, who never connected). */
  readonly log: [string, string][] = [];
  /** Users whose page is watching the server (incoming polls): a manager's page must never appear here. */
  readonly polled = new Set<string>();
  /** Quiet hours (the callee's devices would not ring): `unavailable`, nothing is written. */
  readonly quiet = new Set<string>();
  /** Rejections sent back to a page, `[uid, method, reason]`. */
  readonly rejected: [string, string, string][] = [];

  constructor(private readonly pair: PairIds = PAIR) {}

  private peerOf(uid: string, peerId: string): string {
    const { trainer, client } = this.pair;
    // The trainer's screens know the client by different ids (world `c1`, chat thread `c2`...): in this e2e the trainer has
    // exactly one client, the member page, so any client id of theirs rings it.
    if (uid === trainer.uid && peerId && peerId !== trainer.key) return client.uid;
    if (uid === client.uid && peerId === trainer.key) return trainer.uid;
    return fail('failed-precondition', 'no-active-coaching');
  }
  /** How `uid` knows the other person (what the screens pass as `peerId`). */
  private keyFor(viewer: string, other: string): string {
    const { trainer, client } = this.pair;
    return other === trainer.uid && viewer === client.uid
      ? trainer.key
      : other === client.uid && viewer === trainer.uid
        ? client.key
        : other;
  }
  private view(viewer: string, d: Doc): Doc {
    return {
      ...d,
      callerId: this.keyFor(viewer, d.callerId),
      calleeId: this.keyFor(viewer, d.calleeId),
    };
  }
  private live(uid: string, now: number): Doc | undefined {
    for (const d of this.calls.values()) {
      if (d.callerId !== uid && d.calleeId !== uid) continue;
      if (d.state === 'ringing' && now - d.createdAt < 60_000) return d;
      if (d.state === 'answered' && now - d.createdAt < 120_000) return d;
      if (d.state === 'active' && now - (d.lastSeenAt ?? d.createdAt) < 45_000) return d;
    }
    return undefined;
  }
  private mine(uid: string, callId: string): Doc {
    const d = this.calls.get(callId);
    if (!d || (d.callerId !== uid && d.calleeId !== uid))
      fail('permission-denied', 'not-a-participant');
    return d as Doc;
  }
  private close(d: Doc, reason: string): void {
    if (d.state !== 'ended') {
      d.state = 'ended';
      d.endReason = reason;
    }
  }

  handle(name: string, a: Record<string, unknown>): unknown {
    const uid = a.uid as string;
    if (['incoming', 'getCall', 'ice-since'].includes(name)) this.polled.add(uid);
    else if (name !== 'ice') this.log.push([uid, name]);
    const now = Date.now();
    if (name === 'incoming') {
      return [...this.calls.values()]
        .filter((d) => d.calleeId === uid && d.state === 'ringing' && now - d.createdAt < 60_000)
        .map((d) => this.view(uid, d));
    }
    if (name === 'getCall') {
      const d = this.calls.get(a.callId as string);
      return d && (d.callerId === uid || d.calleeId === uid) ? this.view(uid, d) : null;
    }
    if (name === 'ice-since') {
      const list = this.ice.get(a.callId as string) ?? [];
      return list.filter((c) => c.from !== uid && c.n > (a.after as number));
    }

    const callId = a.callId as string;
    switch (name) {
      case 'start': {
        const existing = this.calls.get(callId);
        if (existing) {
          if (existing.callerId !== uid) fail('already-exists', 'call-id-taken');
          return existing.state === 'ringing'
            ? { state: 'ringing' }
            : { state: 'ended', endReason: existing.endReason ?? 'failed' };
        }
        const callee = this.peerOf(uid, a.peerId as string);
        if (this.live(uid, now)) fail('failed-precondition', 'already-in-call');
        if (this.quiet.has(callee)) return { state: 'ended', endReason: 'unavailable' };
        if (this.live(callee, now)) return { state: 'ended', endReason: 'busy' };
        this.calls.set(callId, {
          id: callId,
          callerId: uid,
          calleeId: callee,
          kind: a.kind as Kind,
          state: 'ringing',
          offer: a.offer,
          createdAt: now,
        });
        return { state: 'ringing' };
      }
      case 'answer': {
        const d = this.mine(uid, callId);
        if (d.calleeId !== uid) fail('permission-denied', 'only-callee');
        if (d.state === 'ended') return {};
        if (!a.accept) {
          this.close(d, 'declined');
        } else if (d.state === 'ringing') {
          if (now - d.createdAt > 60_000) this.close(d, 'missed');
          else {
            d.state = 'answered';
            d.answer = a.answer;
          }
        }
        return {};
      }
      case 'active': {
        const d = this.mine(uid, callId);
        if (d.state === 'ended') fail('failed-precondition', 'call-ended');
        if (d.state === 'ringing') fail('failed-precondition', 'not-answered');
        d.state = 'active';
        d.lastSeenAt = now;
        return { state: 'active' };
      }
      case 'end': {
        const d = this.mine(uid, callId);
        const reason = a.reason as string;
        if (reason === 'declined' && d.calleeId !== uid) fail('permission-denied', 'only-callee');
        if (reason === 'missed' && d.callerId !== uid) fail('permission-denied', 'only-caller');
        this.close(d, reason);
        return { state: 'ended', endReason: d.endReason };
      }
      case 'ice': {
        const d = this.mine(uid, callId);
        if (d.state === 'ended') fail('failed-precondition', 'call-ended');
        const list = this.ice.get(callId) ?? [];
        list.push({ n: list.length + 1, from: uid, candidate: a.candidate });
        this.ice.set(callId, list);
        return { ok: true };
      }
      case 'turn':
        this.mine(uid, callId);
        return { iceServers: [] };
      default:
        return fail('unimplemented', name);
    }
  }

  /** A live call between `uid` and somebody else (another trainer / client): `uid` is busy. */
  injectLive(uid: string, as: 'caller' | 'callee' = 'callee'): void {
    const id = `injected-${this.calls.size}-${Date.now()}`;
    this.calls.set(id, {
      id,
      callerId: as === 'callee' ? 'someone-else' : uid,
      calleeId: as === 'callee' ? uid : 'someone-else',
      kind: 'voice',
      state: 'active',
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });
  }

  /** Calls (any state) the given user started, newest last. */
  startedBy(uid: string): Doc[] {
    return [...this.calls.values()].filter((d) => d.callerId === uid);
  }

  /** Expose the server to every page of the context as `window.__callsRpc`. */
  async attach(context: BrowserContext): Promise<void> {
    await context.exposeBinding(
      '__callsRpc',
      (_src, name: string, args: Record<string, unknown>) => {
        try {
          return { ok: true, v: this.handle(name, args) };
        } catch (e) {
          const f = e as Partial<Fail>;
          this.rejected.push([
            String(args.uid),
            name,
            `${f.reason ?? String(e)} ${String(args.peerId ?? '')}`,
          ]);
          return { ok: false, code: f.code ?? 'internal', reason: f.reason ?? String(e) };
        }
      },
    );
  }
}
