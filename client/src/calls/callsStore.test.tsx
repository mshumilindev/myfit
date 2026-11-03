import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CallSession } from './callSession';
import { IDLE, type CallState } from './callMachine';
import type { CallLogEntry } from './callLog';
import {
  drainCallLogs,
  newCallId,
  openPreflight,
  peerName,
  publishCalls,
  queueCallLog,
  rememberPeer,
  useCallState,
  useCallsPublished,
  usePreflight,
} from './callsStore';

afterEach(() => {
  cleanup();
  publishCalls({ session: null, enabled: false });
  openPreflight(null);
});

const entry: CallLogEntry = { v: 1, k: 'done', video: false, sec: 3 };

function fakeSession(state: CallState) {
  const subs = new Set<() => void>();
  const s = {
    state,
    getState: () => s.state,
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    emit: () => subs.forEach((f) => f()),
    subs,
  };
  return s;
}

describe('publishCalls / useCallsPublished', () => {
  it('starts empty, follows the published value and ignores an identical publish', () => {
    const { result } = renderHook(() => useCallsPublished());
    expect(result.current).toEqual({ session: null, enabled: false });
    const same = result.current;
    act(() => publishCalls({ session: null, enabled: false }));
    expect(result.current).toBe(same);
    const s = fakeSession(IDLE) as unknown as CallSession;
    act(() => publishCalls({ session: s, enabled: true }));
    expect(result.current).toEqual({ session: s, enabled: true });
  });
});

describe('useCallState', () => {
  it('is idle without a session and follows the session when there is one', () => {
    const { result } = renderHook(() => useCallState());
    expect(result.current).toBe(IDLE);
    const fs = fakeSession(IDLE);
    act(() => publishCalls({ session: fs as unknown as CallSession, enabled: true }));
    const next: CallState = { ...IDLE, phase: 'ringing-out', callId: 'c' };
    act(() => {
      fs.state = next;
      fs.emit();
    });
    expect(result.current).toBe(next);
  });

  it('unsubscribes from the session when the hook unmounts', () => {
    const fs = fakeSession(IDLE);
    act(() => publishCalls({ session: fs as unknown as CallSession, enabled: true }));
    const { unmount } = renderHook(() => useCallState());
    expect(fs.subs.size).toBe(1);
    unmount();
    expect(fs.subs.size).toBe(0);
  });
});

describe('peer names', () => {
  it('remembers a name per id; empty ids or names are ignored', () => {
    rememberPeer('p1', 'Anna');
    rememberPeer('', 'Nobody');
    rememberPeer('p2', '');
    expect(peerName('p1')).toBe('Anna');
    expect(peerName('p2')).toBeUndefined();
    expect(peerName(null)).toBeUndefined();
  });
});

describe('newCallId', () => {
  it('is 24 url-safe characters and different each time', () => {
    const a = newCallId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(newCallId()).not.toBe(a);
  });
});

describe('call log queue', () => {
  it('hands waiting lines of the pair over once, keeps other pairs, and ignores duplicates', () => {
    queueCallLog({ peerId: 'qa', callId: 'k1', entry });
    queueCallLog({ peerId: 'qa', callId: 'k1', entry });
    queueCallLog({ peerId: 'qb', callId: 'k2', entry });
    const got: string[] = [];
    const off = drainCallLogs('qa', (_e, id) => got.push(id));
    expect(got).toEqual(['k1']);
    off();
    const other: string[] = [];
    drainCallLogs('qb', (_e, id) => other.push(id))();
    expect(other).toEqual(['k2']);
  });

  it('a line queued while the chat is open is written at once; after unsubscribe it waits', () => {
    const write = vi.fn();
    const off = drainCallLogs('qc', write);
    queueCallLog({ peerId: 'qc', callId: 'k3', entry });
    expect(write).toHaveBeenCalledWith(entry, 'k3');
    off();
    queueCallLog({ peerId: 'qc', callId: 'k4', entry });
    expect(write).toHaveBeenCalledTimes(1);
    const late: string[] = [];
    drainCallLogs('qc', (_e, id) => late.push(id))();
    expect(late).toEqual(['k4']);
  });
});

describe('pre-call check request', () => {
  it('opens, is read by the hook and closes', () => {
    const { result } = renderHook(() => usePreflight());
    expect(result.current).toBeNull();
    act(() => openPreflight({ peerId: 'p', kind: 'video' }));
    expect(result.current).toEqual({ peerId: 'p', kind: 'video' });
    act(() => openPreflight(null));
    expect(result.current).toBeNull();
  });
});
