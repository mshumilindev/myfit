import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallState } from './callMachine';

const h = vi.hoisted(() => ({
  uid: 'me' as string | null,
  role: 'member' as string,
  sessions: [] as unknown[],
  lb: null as null | { api: object; wire: object; devices: object },
}));

vi.mock('../api', () => ({ currentUid: () => h.uid, getRole: () => h.role }));
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

function Probe() {
  const { enabled } = useCallsPublished();
  return <span data-testid="enabled">{String(enabled)}</span>;
}

beforeEach(() => {
  h.uid = 'me';
  h.role = 'member';
  h.sessions.length = 0;
  h.lb = null;
  localStorage.clear();
  vi.stubEnv('VITE_COACH_BACKEND', 'firebase');
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('CallsHost', () => {
  it('a signed-out user gets no session', () => {
    h.uid = null;
    const { container } = render(<CallsHost />);
    expect(h.sessions).toHaveLength(0);
    expect(container.innerHTML).toBe('');
  });

  it('managers never get calls', () => {
    h.role = 'manager';
    render(<CallsHost />);
    expect(h.sessions).toHaveLength(0);
  });

  it('a signed-in user gets a listening session on the Firebase ports, published and rendered (no feature flag)', () => {
    render(
      <>
        <Probe />
        <CallsHost />
      </>,
    );
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
    const prefer = last().opts.preferRelay as () => boolean;
    expect(prefer()).toBe(true);
    localStorage.setItem(CALL_PREFS_KEY, JSON.stringify({ direct: true }));
    expect(prefer()).toBe(false);
  });

  it('unmount disposes the session and unpublishes it', () => {
    const { unmount } = render(
      <>
        <Probe />
        <CallsHost />
      </>,
    );
    const sess = last();
    unmount();
    expect(sess.dispose).toHaveBeenCalledTimes(1);
  });

  it('a finished outgoing call is queued for the chat log, once', () => {
    render(<CallsHost />);
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
    const sess = last();
    sess.state = { ...IDLE };
    act(() => sess.subs.forEach((f) => f()));
    const got: unknown[] = [];
    drainCallLogs('peer-1', (e) => got.push(e))();
    expect(got).toEqual([]);
  });

  it('the fixtures build uses the loopback ports when the test exposed them', () => {
    vi.stubEnv('VITE_COACH_BACKEND', 'fixtures');
    h.lb = { api: { id: 'lb-api' }, wire: { id: 'lb-wire' }, devices: { id: 'lb-dev' } };
    render(<CallsHost />);
    expect(last().opts).toMatchObject({
      api: { id: 'lb-api' },
      wire: { id: 'lb-wire' },
      devices: { id: 'lb-dev' },
    });
  });
});
