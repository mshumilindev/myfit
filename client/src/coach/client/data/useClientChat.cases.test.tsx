/** useClientThread / useClientUnread over a scriptable client chat port and the real client link store. */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../chat/types';
import { configureClientCoach } from './config';
import type { ClientChatPort, ClientThreadData } from './chatPort';
import { createFixturesClientPort } from './__fixtures__/fixtures';
import { useClientThread, useClientUnread } from './useClientChat';

const msg = (id: string, at: number): ChatMessage => ({
  id,
  cid: 'c',
  from: 'trainer',
  at,
  body: { kind: 'text', text: id },
  state: 'sent',
});

interface P extends ClientChatPort {
  push(cid: string, d: ClientThreadData): void;
  err(cid: string): void;
  unread(cid: string, n: number): void;
  subs: string[];
  offs: number;
  sent: string[];
}
function chatPort(): P {
  const th = new Map<string, [(d: ClientThreadData) => void, (e: unknown) => void]>();
  const un = new Map<string, (n: number) => void>();
  const p: P = {
    subs: [],
    offs: 0,
    sent: [],
    now: () => 9000,
    subscribe(cid, on, onError) {
      p.subs.push(cid);
      th.set(cid, [on, onError]);
      return () => void p.offs++;
    },
    subscribeUnread(cid, on) {
      un.set(cid, on);
      p.subs.push(`unread:${cid}`);
      return () => void p.offs++;
    },
    send: async (_c, d) => void p.sent.push(d.id),
    markRead: async () => undefined,
    softDelete: async () => undefined,
    undoDelete: async () => undefined,
    commitDelete: async () => undefined,
    clearChat: async () => ({ previous: 0 }),
    undoClear: async () => undefined,
    push: (cid, d) => th.get(cid)![0](d),
    err: (cid) => th.get(cid)![1](new Error('x')),
    unread: (cid, n) => un.get(cid)!(n),
  };
  return p;
}

beforeEach(() => configureClientCoach());
afterEach(() => configureClientCoach());

describe('useClientThread', () => {
  it('without a conversation it is loading and empty and listens to nothing', () => {
    const p = chatPort();
    const { result } = renderHook(() => useClientThread(null, p));
    expect(result.current.messages).toEqual([]);
    expect(result.current.unread).toBe(0);
    expect(result.current.status).toBe('loading');
    expect(p.subs).toEqual([]);
  });

  it('shows the thread once it arrives with the unread count; an unsent message is merged in as mine', async () => {
    const p = chatPort();
    const { result } = renderHook(() => useClientThread('c', p));
    expect(result.current.status).toBe('loading');
    act(() => p.push('c', { messages: [msg('m1', 100)], unread: 2, clearedBefore: 0 }));
    expect(result.current.status).toBe('ready');
    expect(result.current.unread).toBe(2);
    let id = '';
    act(() => {
      id = result.current.store.send('c', 'hi');
    });
    expect(result.current.messages.map((m) => m.id)).toEqual(['m1', id]);
    expect(result.current.messages[1]).toMatchObject({ from: 'client', state: 'sending' });
    await vi.waitFor(() => expect(result.current.state.outbox).toEqual([]));
    expect(p.sent).toEqual([id]);
  });

  it('an error keeps what was shown and reports error; retry resubscribes and goes back to loading until data comes', () => {
    const p = chatPort();
    const { result } = renderHook(() => useClientThread('c', p));
    act(() => p.push('c', { messages: [msg('m1', 100)], unread: 0, clearedBefore: 0 }));
    act(() => p.err('c'));
    expect(result.current.status).toBe('error');
    expect(result.current.messages.map((m) => m.id)).toEqual(['m1']);
    act(() => result.current.retry());
    expect(result.current.status).toBe('loading');
    expect(p.subs).toEqual(['c', 'c']);
    expect(p.offs).toBe(1);
    act(() =>
      p.push('c', { messages: [msg('m1', 100), msg('m2', 200)], unread: 1, clearedBefore: 0 }),
    );
    expect(result.current.status).toBe('ready');
    expect(result.current.messages).toHaveLength(2);
  });

  it("an error before any data for this conversation shows an empty thread, never another conversation's", () => {
    const p = chatPort();
    const { result, rerender } = renderHook(({ cid }) => useClientThread(cid, p), {
      initialProps: { cid: 'a' },
    });
    act(() => p.push('a', { messages: [msg('secret-of-a', 100)], unread: 3, clearedBefore: 0 }));
    expect(result.current.messages.map((m) => m.id)).toEqual(['secret-of-a']);
    rerender({ cid: 'b' });
    // while b has not answered, a's messages and unread are not shown under b
    expect(result.current.messages).toEqual([]);
    expect(result.current.unread).toBe(0);
    expect(result.current.status).toBe('loading');
    act(() => p.err('b'));
    expect(result.current.messages).toEqual([]);
    expect(result.current.unread).toBe(0);
    expect(result.current.status).toBe('error');
    expect(p.offs).toBe(1); // a's listener was released
  });

  it('unmounting releases the listener', () => {
    const p = chatPort();
    const { unmount } = renderHook(() => useClientThread('c', p));
    unmount();
    expect(p.offs).toBe(1);
  });

  it('the configured port is used when none is passed', () => {
    const p = chatPort();
    configureClientCoach({ chat: p });
    renderHook(() => useClientThread('c'));
    expect(p.subs).toEqual(['c']);
  });
});

describe('useClientUnread', () => {
  it('is 0 without a trainer link and listens to nothing', () => {
    const p = chatPort();
    configureClientCoach({ port: createFixturesClientPort({ scenario: 'none' }), chat: p });
    const { result } = renderHook(() => useClientUnread());
    expect(result.current).toBe(0);
    expect(p.subs).toEqual([]);
  });

  it('follows the unread number of my conversation and stops listening on unmount', () => {
    const p = chatPort();
    const link = createFixturesClientPort({ scenario: 'active' });
    configureClientCoach({ port: link, chat: p });
    const cid = link.state().link.cid!;
    const { result, unmount } = renderHook(() => useClientUnread());
    expect(p.subs).toEqual([`unread:${cid}`]);
    act(() => p.unread(cid, 4));
    expect(result.current).toBe(4);
    unmount();
    expect(p.offs).toBe(1);
  });

  it('an explicit port is used instead of the configured one', () => {
    const configured = chatPort();
    const explicit = chatPort();
    const link = createFixturesClientPort({ scenario: 'active' });
    configureClientCoach({ port: link, chat: configured });
    renderHook(() => useClientUnread(explicit));
    expect(explicit.subs).toHaveLength(1);
    expect(configured.subs).toEqual([]);
  });
});
