import {
  callReducer,
  HEARTBEAT_MS,
  IDLE,
  isLive,
  RING_MS,
  type CallEndReason,
  type CallEvent,
  type CallKind,
  type CallState,
} from './callMachine';
import {
  endReasonFromMediaError,
  endReasonFromServer,
  type CallApi,
  type CallDevices,
  type CallDoc,
  type CallError,
  type CallWire,
  type Unsubscribe,
} from './callPorts';

/** Media lost this long on a video call: drop the video and keep the voice. */
export const DEGRADE_AFTER_MS = 6_000;
/** Media lost this long: give up. (No re-offer in the contract, so we wait for the link to come back.) */
export const GIVE_UP_AFTER_MS = 20_000;
export const STUN_ONLY: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

export interface CallSessionOptions {
  uid: string;
  api: CallApi;
  wire: CallWire;
  devices: CallDevices;
  /** Prefer a relay (hides each side's address from the other). Default true; "Direct connection" turns it off. */
  preferRelay?: () => boolean;
}

/**
 * One call at a time (SPO-444). Owns the peer connection, the media streams and the server signalling; the visible
 * state is the pure `callReducer`. UI: subscribe() + getState(), and the methods below.
 */
export class CallSession {
  private state: CallState = IDLE;
  private listeners = new Set<() => void>();
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private remote: MediaStream | null = null;
  private offer: CallDoc['offer'];
  private pendingIce: RTCIceCandidateInit[] = [];
  private haveRemote = false;
  private unsubs: Unsubscribe[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private stopIncoming: Unsubscribe | null = null;
  private epoch = 0; // bumps per call, so late async work of an old call is ignored

  constructor(private readonly o: CallSessionOptions) {}

  // ---- observable ----
  getState = (): CallState => this.state;
  subscribe = (fn: () => void): Unsubscribe => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getLocalStream = (): MediaStream | null => this.local;
  getRemoteStream = (): MediaStream | null => this.remote;

  private dispatch(e: CallEvent): void {
    const next = callReducer(this.state, e);
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  /** Start listening for calls that ring this user. */
  listen(): void {
    this.stopIncoming?.();
    this.stopIncoming = this.o.wire.watchIncoming(this.o.uid, (d) => this.onIncoming(d));
  }

  dispose(): void {
    this.stopIncoming?.();
    this.stopIncoming = null;
    this.cleanup();
    this.listeners.clear();
  }

  /** Back to idle after the UI has shown the end state. */
  dismiss(): void {
    if (this.state.phase === 'ended') this.dispatch({ type: 'reset' });
  }

  // ---- outgoing ----
  async dial(peerId: string, kind: CallKind, callId: string): Promise<void> {
    if (isLive(this.state)) return;
    const epoch = ++this.epoch;
    this.dispatch({ type: 'dial', callId, peerId, kind });
    if (!this.o.devices.online()) return this.finish('offline');
    try {
      this.local = await this.o.devices.getMedia(kind);
    } catch (e) {
      if (epoch === this.epoch) this.finish(endReasonFromMediaError(e));
      return;
    }
    if (epoch !== this.epoch) return this.stopLocal();
    try {
      const pc = this.makePeer(STUN_ONLY, 'all');
      const offer = await pc.createOffer();
      const res = await this.o.api.start({
        callId,
        peerId,
        kind,
        offer: { type: 'offer', sdp: offer.sdp ?? '' },
        relayOnly: false,
      });
      if (epoch !== this.epoch) return;
      if (res.state === 'ended') return this.finish(res.endReason);
      // The call exists now, so the server will hand out TURN credentials (they need a live call).
      const servers = await this.iceServers(callId);
      if (epoch !== this.epoch) return;
      pc.setConfiguration(this.configFor(servers));
      await pc.setLocalDescription(offer);
      this.watch(callId);
      this.armRing(epoch, 'missed');
    } catch (e) {
      if (epoch === this.epoch) this.finish(this.errorReason(e));
    }
  }

  // ---- incoming ----
  private onIncoming(d: CallDoc): void {
    if (isLive(this.state) || d.state !== 'ringing' || !d.offer) return;
    this.offer = d.offer;
    const epoch = ++this.epoch;
    this.dispatch({ type: 'incoming', callId: d.id, peerId: d.callerId, kind: d.kind });
    this.watch(d.id);
    this.armRing(epoch, null);
  }

  async answer(opts: { voiceOnly?: boolean } = {}): Promise<void> {
    const s = this.state;
    if (s.phase !== 'ringing-in' || !s.callId || !this.offer) return;
    const { callId } = s;
    const epoch = this.epoch;
    const kind: CallKind = opts.voiceOnly ? 'voice' : s.kind;
    this.dispatch({ type: opts.voiceOnly ? 'accept-voice' : 'accept' });
    this.clearTimers();
    try {
      this.local = await this.o.devices.getMedia(kind);
      // hung up or disposed while the permission prompt was open: do not answer a call that is gone
      if (epoch !== this.epoch) return this.stopLocal();
    } catch (e) {
      const reason = endReasonFromMediaError(e);
      void this.o.api.answer({ callId, accept: false }).catch(() => {});
      if (epoch === this.epoch) this.finish(reason);
      return;
    }
    try {
      const servers = await this.iceServers(callId);
      if (epoch !== this.epoch) return this.stopLocal();
      const pc = this.makePeer(servers, this.policy(servers));
      await pc.setRemoteDescription(this.offer);
      this.haveRemote = true;
      await this.flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.o.api.answer({
        callId,
        accept: true,
        answer: { type: 'answer', sdp: answer.sdp ?? '' },
      });
    } catch (e) {
      if (epoch === this.epoch) this.finish(this.errorReason(e));
    }
  }

  decline(): void {
    const { phase, callId } = this.state;
    if (phase !== 'ringing-in' || !callId) return;
    void this.o.api.answer({ callId, accept: false }).catch(() => {});
    this.finish('declined');
  }

  hangup(): void {
    const { phase, callId } = this.state;
    if (!isLive(this.state) || !callId) return;
    if (phase === 'ringing-in') return this.decline();
    void this.o.api.end(callId, 'hangup').catch(() => {});
    this.finish('hangup');
  }

  toggleMic(): void {
    this.dispatch({ type: 'toggle-mic' });
    this.local?.getAudioTracks().forEach((t) => (t.enabled = this.state.micOn));
  }

  toggleCam(): void {
    this.dispatch({ type: 'toggle-cam' });
    this.local?.getVideoTracks().forEach((t) => (t.enabled = this.state.camOn));
  }

  // ---- plumbing ----
  private policy(servers: RTCIceServer[]): RTCIceTransportPolicy {
    const hasRelay = servers.some((s) =>
      [s.urls].flat().some((u) => typeof u === 'string' && u.startsWith('turn')),
    );
    return hasRelay && (this.o.preferRelay?.() ?? true) ? 'relay' : 'all';
  }

  private configFor(servers: RTCIceServer[]): RTCConfiguration {
    return { iceServers: servers, iceTransportPolicy: this.policy(servers) };
  }

  private async iceServers(callId: string): Promise<RTCIceServer[]> {
    try {
      const r = await this.o.api.turn(callId);
      return r.iceServers.length ? r.iceServers : STUN_ONLY;
    } catch {
      return STUN_ONLY; // calls still work direct when TURN is unavailable
    }
  }

  private makePeer(servers: RTCIceServer[], iceTransportPolicy: RTCIceTransportPolicy) {
    const pc = this.o.devices.createPeer({ iceServers: servers, iceTransportPolicy });
    this.pc = pc;
    this.remote = new MediaStream();
    this.local?.getTracks().forEach((t) => pc.addTrack(t, this.local as MediaStream));
    pc.ontrack = (ev) => ev.streams[0]?.getTracks().forEach((t) => this.remote?.addTrack(t));
    pc.onicecandidate = (ev) => {
      const id = this.state.callId;
      if (ev.candidate && id) {
        void this.o.api.ice(id, ev.candidate.toJSON()).catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => this.onConnection(pc.connectionState);
    return pc;
  }

  private onConnection(cs: RTCPeerConnectionState): void {
    if (cs === 'connected') {
      this.clearTimers();
      if (this.state.phase === 'reconnecting') this.dispatch({ type: 'link-back' });
      else this.dispatch({ type: 'connected', at: this.o.devices.now() });
      this.startHeartbeat();
    } else if (cs === 'disconnected') {
      this.dispatch({ type: 'link-lost' });
      this.timers.push(
        setTimeout(() => {
          if (this.state.phase === 'reconnecting' && this.state.kind === 'video') {
            this.dispatch({ type: 'degrade' });
            this.local?.getVideoTracks().forEach((t) => t.stop());
          }
        }, DEGRADE_AFTER_MS),
        setTimeout(() => this.failCall(), GIVE_UP_AFTER_MS),
      );
    } else if (cs === 'failed') {
      this.failCall();
    }
  }

  private failCall(): void {
    const id = this.state.callId;
    if (!isLive(this.state) || !id) return;
    void this.o.api.end(id, 'failed').catch(() => {});
    this.finish('failed');
  }

  private startHeartbeat(): void {
    if (this.heartbeat) return;
    const id = this.state.callId;
    if (!id) return;
    const beat = () => void this.o.api.active(id).catch(() => {});
    beat();
    this.heartbeat = setInterval(beat, HEARTBEAT_MS);
  }

  private watch(callId: string): void {
    this.unsubs.push(
      this.o.wire.watchCall(callId, (d) => {
        if (!d || callId !== this.state.callId) return;
        if (d.state === 'ended') {
          this.finish(endReasonFromServer(d.endReason));
        } else if (d.state !== 'ringing' && d.answer && this.state.role === 'caller') {
          if (this.state.phase === 'ringing-out') this.dispatch({ type: 'remote-answered' });
          void this.applyAnswer(d.answer);
        }
      }),
      this.o.wire.watchIce(callId, this.o.uid, (c) => {
        if (!this.pc || !this.haveRemote) this.pendingIce.push(c.candidate);
        else void this.pc.addIceCandidate(c.candidate).catch(() => {});
      }),
    );
  }

  private async applyAnswer(answer: NonNullable<CallDoc['answer']>): Promise<void> {
    if (!this.pc || this.haveRemote) return;
    this.haveRemote = true;
    try {
      await this.pc.setRemoteDescription(answer);
      await this.flushIce();
    } catch {
      this.failCall();
    }
  }

  private async flushIce(): Promise<void> {
    const queued = this.pendingIce.splice(0);
    for (const c of queued) await this.pc?.addIceCandidate(c).catch(() => {});
  }

  private armRing(epoch: number, serverReason: 'missed' | null): void {
    this.timers.push(
      setTimeout(() => {
        if (epoch !== this.epoch) return;
        const { phase, callId } = this.state;
        if (phase !== 'ringing-out' && phase !== 'ringing-in') return;
        if (serverReason && callId) void this.o.api.end(callId, serverReason).catch(() => {});
        this.finish('missed');
      }, RING_MS),
    );
  }

  private errorReason(e: unknown): CallEndReason {
    const err = e as CallError;
    // `already-in-call` also arrives as failed-precondition, so it is told apart by its reason first
    if (err?.reason === 'already-in-call') return 'busy';
    if (err?.reason === 'calls-disabled' || err?.code === 'failed-precondition') return 'disabled';
    if (err?.code === 'unavailable' || err?.code === 'deadline-exceeded') return 'offline';
    return 'failed';
  }

  private finish(reason: CallEndReason): void {
    this.dispatch({ type: 'end', reason, at: this.o.devices.now() });
    this.cleanup();
  }

  private stopLocal(): void {
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  private cleanup(): void {
    this.epoch++;
    this.clearTimers();
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.pc?.close();
    this.pc = null;
    this.stopLocal();
    this.remote = null;
    this.offer = undefined;
    this.pendingIce = [];
    this.haveRemote = false;
  }
}
