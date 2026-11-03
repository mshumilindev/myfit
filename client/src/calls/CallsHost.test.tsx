import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallState } from './callMachine';

const h = vi.hoisted(() => ({
  uid: 'me' as string | null,
  role: 'member' as string,
  flagCb: null as null | ((s: { data: () => { calls?: boolean } | undefined }) => void),
  flagErr: null as null | (() => void),
  flagOff: vi.fn(),
  sessions: [] as unknown[],
  lb: null as null | {
    api: object;
    wire: object;
    devices: object;
    watchFlag: (uid: string, cb: (on: boolean) => void) => () => void;
  },
}));

vi.mock('../api', () => ({ currentUid: () => h.uid, getRole: () => h.role }));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_d: unknown, ...p: string[]) => p.join('/'),
  onSnapshot: (
    _ref: unknown,
    next: (s: { data: () => { calls?: boolean } | undefined }) => void,
    err: () => void,
  ) => {
    h.flagCb = next;
    h.flagErr = err;
    return h.flagOff;
  },
}));
vi.mock('./callsFirebase', () => ({
  firebaseCallApi: { id: 'fb-api' },
  firebaseCallWire: { id: 'fb-wire' },
  browserCallDevices: { id: 'browser' },
}));
vi.mock('./callsLoopback', () => ({ loopbackPorts: () => h.lb }));
vi.mock('./CallLayer', () => ({ CallLayer: () => <div data-testid="layer" /> }));
vi.mock('./callSession', () => ({
  CallSession: class {
    state: CallState | null = null;
    subs = new Set<() => void>();
    listen = vi.fn();
    dispose = vi.fn();
    constructor(public opts: Record<string, unknown>) {
      h.sessions.push(this);
    }
    subscribe(fn: () => void) {
      this.subs.add(fn);
      return () => this.subs.delete(fn);
    }
    getState() {
      return this.state as CallState;
    }
  },
}));

import CallsHost from './CallsHost';
import { drainCallLogs } from './callsStore';
import { useCallsPublished } from './callsStore';
import { CALL_PREFS_KEY } from './callPrefs';
import { IDLE } from './callMachine';
import type { CallLogEntry } from './callLog';

interface FakeSession {
  state: CallState;
  subs: Set<() => void>;
  listen: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  opts: Record<string, unknown>;
}
const last = () => h.sessions[h.sessions.length - 1] as FakeSession;
const flagOn = (on: boolean) =>
  act(() => h.flagCb?.({ data: () => (on ? { calls: true } : undefined) }));

function Probe() {
  const { enabled } = useCallsPublished();
  return <span data-testid="enabled">{String(enabled)}</span>;
}

beforeEach(() => {
  h.uid = 'me';
  h.role = 'member';
  h.flagCb = null;
  h.flagErr = null;
  h.sessions.length = 0;
  h.lb = null;
  h.flagOff.mockClear();
  localStorage.clear();
  vi.stubEnv('VITE_COACH_BACKEND', 'firebase');
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('CallsHost', () => {
  it('a signed-out user gets no listener and no session', () => {
    h.uid = null;
    const { container } = render(<CallsHost />);
    expect(h.flagCb).toBeNull();
    expect(h.sessions).toHaveLength(0);
    expect(container.innerHTML).toBe('');
  });

  it('managers never get calls', () => {
    h.role = 'manager';
    render(<CallsHost />);
    expect(h.flagCb).toBeNull();
    expect(h.sessions).toHaveLength(0);
  });

  it('flag off: no session; flag on: a listening session on the Firebase ports, published and rendered', () => {
    render(
      <>
        <Probe />
        <CallsHost />
      </>,
    );
    flagOn(false);
    expect(h.sessions).toHaveLength(0);
    expect(screen.queryByTestId('layer')).toBeNull();
    flagOn(true);
    expect(h.sessions).toHaveLength(1);
    expect(last().listen).toHaveBeenCalled();
    expect(last().opts).toMatchObject({
      uid: 'me',
      api: { id: 'fb-api' },
      wire: { id: 'fb-wire' },
      devices: { id: 'browser' },
    });
    expect(screen.getByTestId('layer')).toBeTruthy();
    expect(screen.getByTestId('enabled').textContent).toBe('true');
  });

  it('relay is preferred unless the user chose a direct connection', () => {
    render(<CallsHost />);
    flagOn(true);
    const prefer = last().opts.preferRelay as () => boolean;
    expect(prefer()).toBe(true);
    localStorage.setItem(CALL_PREFS_KEY, JSON.stringify({ direct: true }));
    expect(prefer()).toBe(false);
  });

  it('a snapshot error switches calls off again', () => {
    render(<CallsHost />);
    flagOn(true);
    const sess = last();
    act(() => h.flagErr?.());
    expect(sess.dispose).toHaveBeenCalled();
    expect(screen.queryByTestId('layer')).toBeNull();
  });

  it('turning the flag off disposes the session and unpublishes it', () => {
    render(
      <>
        <Probe />
        <CallsHost />
      </>,
    );
    flagOn(true);
    const sess = last();
    flagOn(false);
    expect(sess.dispose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('enabled').textContent).toBe('false');
  });

  it('unmount stops the flag watch and disposes the session', () => {
    const { unmount } = render(<CallsHost />);
    flagOn(true);
    const sess = last();
    unmount();
    expect(h.flagOff).toHaveBeenCalled();
    expect(sess.dispose).toHaveBeenCalled();
  });

  it('a finished outgoing call is queued for the chat log, once', () => {
    render(<CallsHost />);
    flagOn(true);
    const sess = last();
    sess.state = {
      ...IDLE,
      phase: 'ended',
      role: 'caller',
      kind: 'voice',
      callId: 'call-1',
      peerId: 'peer-1',
      endReason: 'declined',
      connectedAt: null,
      endedAt: 5,
    };
    act(() => sess.subs.forEach((f) => f()));
    act(() => sess.subs.forEach((f) => f()));
    const got: [CallLogEntry, string][] = [];
    const off = drainCallLogs('peer-1', (e, id) => got.push([e, id]));
    off();
    expect(got).toEqual([[{ v: 1, k: 'declined', video: false, sec: 0 }, 'call-1']]);
  });

  it('a state that leaves no log line queues nothing', () => {
    render(<CallsHost />);
    flagOn(true);
    const sess = last();
    sess.state = { ...IDLE };
    act(() => sess.subs.forEach((f) => f()));
    const got: unknown[] = [];
    drainCallLogs('peer-1', (e) => got.push(e))();
    expect(got).toEqual([]);
  });

  it('the fixtures build uses the loopback ports and server switch when the test exposed them', () => {
    vi.stubEnv('VITE_COACH_BACKEND', 'fixtures');
    let push: (on: boolean) => void = () => {};
    const off = vi.fn();
    h.lb = {
      api: { id: 'lb-api' },
      wire: { id: 'lb-wire' },
      devices: { id: 'lb-dev' },
      watchFlag: (_u, cb) => {
        push = cb;
        return off;
      },
    };
    const { unmount } = render(<CallsHost />);
    expect(h.flagCb).toBeNull();
    act(() => push(true));
    expect(last().opts).toMatchObject({
      api: { id: 'lb-api' },
      wire: { id: 'lb-wire' },
      devices: { id: 'lb-dev' },
    });
    unmount();
    expect(off).toHaveBeenCalled();
  });
});
