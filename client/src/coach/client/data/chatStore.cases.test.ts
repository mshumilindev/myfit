/** Client chat store over a scriptable port: outbox lifecycle, the single undo window, merge of unsent messages. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../chat/types';
import { UNDO_MS } from '../../chat/types';
import type { ClientChatPort } from './chatPort';
import { clientChatStoreFor, createClientChatStore, mergeClientOutbox } from './chatStore';

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

function port(over: Partial<ClientChatPort> = {}): ClientChatPort & { calls: string[] } {
  const calls: string[] = [];
  const rec =
    <T>(name: string, v: T) =>
    async (...a: unknown[]) => {
      calls.push(
        `${name}:${a.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(',')}`,
      );
      return v;
    };
  return {
    calls,
    now: () => 5000,
    subscribe: () => () => undefined,
    subscribeUnread: () => () => undefined,
    send: rec('send', undefined) as never,
    markRead: rec('markRead', undefined) as never,
    softDelete: rec('softDelete', undefined) as never,
    undoDelete: rec('undoDelete', undefined) as never,
    commitDelete: rec('commitDelete', undefined) as never,
    clearChat: rec('clearChat', { previous: 42 }) as never,
    undoClear: rec('undoClear', undefined) as never,
    ...over,
  };
}
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('outbox', () => {
  it('send adds a trimmed message as sending, transmits it with the port clock, and removes it once stored', async () => {
    const p = port();
    const s = createClientChatStore(p);
    const f = vi.fn();
    s.subscribe(f);
    const id = s.send('cid-1', '  hello coach  ');
    expect(s.getState().outbox).toEqual([
      { id, cid: 'cid-1', text: 'hello coach', at: 5000, state: 'sending' },
    ]);
    await flush();
    expect(p.calls).toEqual([`send:cid-1,{"id":"${id}","text":"hello coach","at":5000}`]);
    expect(s.getState().outbox).toEqual([]);
    expect(f).toHaveBeenCalled();
  });

  it('a body is sent with the message and kept in the outbox entry', async () => {
    const send = vi.fn(async () => undefined);
    const s = createClientChatStore(port({ send }));
    const body = { kind: 'share' as const, shareId: 'x' } as never;
    const id = s.send('c', 'card', body);
    expect(s.getState().outbox[0].body).toBe(body);
    await flush();
    expect(send).toHaveBeenCalledWith('c', { id, text: 'card', at: 5000, body });
  });

  it('a failed send stays as failed; retry sends the same id again; discard drops it', async () => {
    let fail = true;
    const send = vi.fn(async () => {
      if (fail) throw new Error('offline');
    });
    const s = createClientChatStore(port({ send }));
    const id = s.send('c', 'hi');
    await flush();
    expect(s.getState().outbox[0]).toMatchObject({ id, state: 'failed' });
    fail = false;
    s.retry(id);
    expect(s.getState().outbox[0].state).toBe('sending');
    await flush();
    expect(s.getState().outbox).toEqual([]);
    expect(send.mock.calls.map((c) => (c as unknown as [string, { id: string }])[1].id)).toEqual([
      id,
      id,
    ]);

    fail = true;
    const id2 = s.send('c', 'again');
    await flush();
    s.discard(id2);
    expect(s.getState().outbox).toEqual([]);
  });

  it('retry of an unknown id does nothing', async () => {
    const send = vi.fn(async () => undefined);
    const s = createClientChatStore(port({ send }));
    s.retry('ghost');
    await flush();
    expect(send).not.toHaveBeenCalled();
  });

  it('unsubscribe stops notifications; markRead is fire-and-forget and swallows a failure', async () => {
    const markRead = vi.fn(async () => {
      throw new Error('x');
    });
    const s = createClientChatStore(port({ markRead }));
    const f = vi.fn();
    const off = s.subscribe(f);
    off();
    s.send('c', 'x');
    expect(f).not.toHaveBeenCalled();
    s.markRead('c');
    await flush();
    expect(markRead).toHaveBeenCalledWith('c');
  });
});

describe('undo window', () => {
  it('deleting a message hides it, opens an 8 s window, and commits the delete when the window closes', async () => {
    const p = port();
    const s = createClientChatStore(p);
    s.deleteMessage('c', 'm1');
    await flush();
    expect(s.getState().pending).toEqual({
      kind: 'message',
      cid: 'c',
      id: 'm1',
      until: 1_000_000 + UNDO_MS,
    });
    await vi.advanceTimersByTimeAsync(UNDO_MS - 1);
    expect(p.calls).toEqual(['softDelete:c,m1']);
    await vi.advanceTimersByTimeAsync(2);
    expect(s.getState().pending).toBeNull();
    expect(p.calls).toEqual(['softDelete:c,m1', 'commitDelete:c,m1']);
  });

  it('undo reverts the delete and never commits it', async () => {
    const p = port();
    const s = createClientChatStore(p);
    s.deleteMessage('c', 'm1');
    await flush();
    s.undo();
    await flush();
    expect(s.getState().pending).toBeNull();
    await vi.advanceTimersByTimeAsync(UNDO_MS * 2);
    expect(p.calls).toEqual(['softDelete:c,m1', 'undoDelete:c,m1']);
  });

  it('clearing the chat undoes with the previous marker; closing the window needs no commit', async () => {
    const p = port();
    const s = createClientChatStore(p);
    s.clearChat('c');
    await flush();
    expect(s.getState().pending).toMatchObject({ kind: 'chat', cid: 'c' });
    s.undo();
    await flush();
    expect(p.calls).toEqual(['clearChat:c', 'undoClear:c,42']);

    const p2 = port();
    const s2 = createClientChatStore(p2);
    s2.clearChat('c');
    await flush();
    await vi.advanceTimersByTimeAsync(UNDO_MS + 1);
    expect(s2.getState().pending).toBeNull();
    expect(p2.calls).toEqual(['clearChat:c']);
  });

  it('a second erase closes the first one now (one toast at a time): the first is committed', async () => {
    const p = port();
    const s = createClientChatStore(p);
    s.deleteMessage('c', 'm1');
    await flush();
    s.deleteMessage('c', 'm2');
    await flush();
    expect(p.calls).toEqual(['softDelete:c,m1', 'softDelete:c,m2', 'commitDelete:c,m1']);
    expect(s.getState().pending).toMatchObject({ id: 'm2' });
  });

  it('settle (leaving the chat) commits the pending erase at once; with nothing pending it is harmless', async () => {
    const p = port();
    const s = createClientChatStore(p);
    s.settle();
    s.deleteMessage('c', 'm1');
    await flush();
    s.settle();
    await flush();
    expect(s.getState().pending).toBeNull();
    expect(p.calls).toEqual(['softDelete:c,m1', 'commitDelete:c,m1']);
    await vi.advanceTimersByTimeAsync(UNDO_MS * 2);
    expect(p.calls).toHaveLength(2);
  });

  it('a delete or clear the port refuses opens no window; a failing commit or revert is swallowed', async () => {
    const s = createClientChatStore(
      port({
        softDelete: async () => {
          throw new Error('offline');
        },
        clearChat: async () => {
          throw new Error('offline');
        },
      }),
    );
    s.deleteMessage('c', 'm1');
    s.clearChat('c');
    await flush();
    expect(s.getState().pending).toBeNull();

    const s2 = createClientChatStore(
      port({
        commitDelete: async () => {
          throw new Error('x');
        },
        undoDelete: async () => {
          throw new Error('x');
        },
      }),
    );
    s2.deleteMessage('c', 'm1');
    await flush();
    s2.settle();
    s2.deleteMessage('c', 'm2');
    await flush();
    s2.undo();
    await flush();
    expect(s2.getState().pending).toBeNull();
  });

  it('undo with nothing pending changes nothing; the window length is configurable', async () => {
    const p = port();
    const s = createClientChatStore(p, 100);
    s.undo();
    s.deleteMessage('c', 'm1');
    await flush();
    expect(s.getState().pending!.until).toBe(1_000_100);
    await vi.advanceTimersByTimeAsync(101);
    expect(p.calls).toContain('commitDelete:c,m1');
  });
});

describe('clientChatStoreFor', () => {
  it('one store per port', () => {
    const a = port();
    const b = port();
    expect(clientChatStoreFor(a)).toBe(clientChatStoreFor(a));
    expect(clientChatStoreFor(a)).not.toBe(clientChatStoreFor(b));
    expect(clientChatStoreFor(a).port).toBe(a);
  });
});

describe('mergeClientOutbox', () => {
  const msg = (id: string, at: number, from: ChatMessage['from'] = 'trainer'): ChatMessage => ({
    id,
    cid: 'c',
    from,
    at,
    body: { kind: 'text', text: id },
    state: 'sent',
  });
  const out = (
    id: string,
    cid: string,
    at: number,
    state: 'sending' | 'failed' = 'sending',
    body?: never,
  ) => ({
    id,
    cid,
    text: `text ${id}`,
    at,
    state,
    ...(body ? { body } : {}),
  });

  it("adds only this conversation's unsent messages as mine, in time order, with their state", () => {
    const merged = mergeClientOutbox(
      [msg('m1', 100), msg('m2', 300)],
      [out('o1', 'c', 200), out('o2', 'other', 250), out('o3', 'c', 400, 'failed')],
      'c',
    );
    expect(merged.map((m) => m.id)).toEqual(['m1', 'o1', 'm2', 'o3']);
    expect(merged[1]).toMatchObject({
      from: 'client',
      cid: 'c',
      state: 'sending',
      body: { kind: 'text', text: 'text o1' },
    });
    expect(merged[3].state).toBe('failed');
  });

  it('a message that already arrived (same id) is not shown twice; an explicit body wins over the text', () => {
    const body = { kind: 'system', type: 'x', text: 'card' } as never;
    const merged = mergeClientOutbox(
      [msg('o1', 100, 'client')],
      [out('o1', 'c', 100), out('o2', 'c', 150, 'sending', body)],
      'c',
    );
    expect(merged.map((m) => m.id)).toEqual(['o1', 'o2']);
    expect(merged[1].body).toBe(body);
  });

  it('nothing in, nothing out', () => {
    expect(mergeClientOutbox([], [], 'c')).toEqual([]);
  });
});
