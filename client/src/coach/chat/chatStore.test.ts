import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnreadStore } from '../data/unreadStore';
import { createChatStore, conversationsFromChat, mergeOutbox } from './chatStore';
import { createFixturesChatPort, type FixturesChatPort } from './__fixtures__/fixtures';
import { UNDO_MS, type ChatMessage } from './types';

let port: FixturesChatPort;
beforeEach(() => {
  vi.useFakeTimers();
  port = createFixturesChatPort();
});
afterEach(() => vi.useRealTimers());

const msgs = (cid: string): ChatMessage[] => {
  let out: ChatMessage[] = [];
  port.subscribeMessages(
    cid,
    (m) => (out = m),
    () => undefined,
  )();
  return out;
};
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('chat store', () => {
  it('one thread listener serves everyone; counts are exact per client (3/12/1/0/0 = 16)', async () => {
    const s = createChatStore(port);
    s.retain('t');
    s.retain('t');
    const byClient = Object.fromEntries(s.getState().threads.map((t) => [t.clientId, t.unread]));
    expect(byClient).toEqual({ c1: 3, c2: 12, c3: 1, c7: 0, c9: 0 });
    s.release();
    s.release();
  });

  it('the nav badge and the list read the same snapshot, and opening a thread clears both together', async () => {
    const s = createChatStore(port);
    const adapter = conversationsFromChat(port);
    const u = createUnreadStore(adapter, 't');
    u.start();
    expect(u.getState().total).toBe(16);
    expect(u.getState().byClient.c2).toBe(12);
    s.markRead('cid-c2');
    await flush();
    expect(u.getState().total).toBe(4);
    expect(u.getState().byClient.c2).toBeUndefined();
    port.receive('cid-c7', 'hi');
    expect(u.getState().total).toBe(5);
    u.stop();
  });

  it('send: shows at once as sending, then lands; the same id is never delivered twice', async () => {
    const s = createChatStore(port);
    s.retain('t');
    const id = s.send('cid-c1', '  See you Saturday.  ');
    expect(s.getState().outbox['cid-c1'][0]).toMatchObject({
      id,
      text: 'See you Saturday.',
      state: 'sending',
    });
    await flush();
    expect(s.getState().outbox['cid-c1']).toEqual([]);
    expect(msgs('cid-c1').filter((m) => m.id === id)).toHaveLength(1);
    await port.send('cid-c1', { id, text: 'dup', at: 1 });
    expect(msgs('cid-c1').filter((m) => m.id === id)).toHaveLength(1);
  });

  it('send failure keeps the text as failed, Retry delivers it', async () => {
    let fail = true;
    port = createFixturesChatPort({ failSend: () => fail });
    const s = createChatStore(port);
    const id = s.send('cid-c1', 'Hello');
    await flush();
    expect(s.getState().outbox['cid-c1'][0].state).toBe('failed');
    expect(mergeOutbox([], s.getState().outbox['cid-c1'])[0].state).toBe('failed');
    fail = false;
    s.retrySend('cid-c1', id);
    await flush();
    expect(s.getState().outbox['cid-c1']).toEqual([]);
    expect(msgs('cid-c1').some((m) => m.id === id)).toBe(true);
  });

  it('delete: hidden for the sender at once, Undo within the window restores it', async () => {
    const s = createChatStore(port);
    const target = msgs('cid-c1').find((m) => m.from === 'trainer')!;
    s.deleteMessage('cid-c1', target.id);
    await flush();
    expect(msgs('cid-c1').some((m) => m.id === target.id)).toBe(false);
    expect(s.getState().pending).toMatchObject({ kind: 'message', cid: 'cid-c1', id: target.id });
    await vi.advanceTimersByTimeAsync(UNDO_MS - 100);
    s.undo();
    await flush();
    expect(msgs('cid-c1').some((m) => m.id === target.id && !m.deleted)).toBe(true);
    expect(s.getState().pending).toBeNull();
  });

  it('delete: after 8 s the text is really gone (tombstone, no body), Undo no longer exists', async () => {
    const s = createChatStore(port);
    const target = msgs('cid-c1').find((m) => m.from === 'trainer')!;
    s.deleteMessage('cid-c1', target.id);
    await flush();
    await vi.advanceTimersByTimeAsync(UNDO_MS + 50);
    const dead = port.dump('cid-c1').find((m) => m.id === target.id)!;
    expect(dead.deleted).toBe(true);
    expect(dead.body).toEqual({ kind: 'unsupported' });
    expect(s.getState().pending).toBeNull();
    s.undo();
    await flush();
    expect(port.dump('cid-c1').find((m) => m.id === target.id)!.deleted).toBe(true);
  });

  it('only own messages can be deleted (the port refuses the other side)', async () => {
    const s = createChatStore(port);
    const theirs = msgs('cid-c1').find((m) => m.from === 'client')!;
    s.deleteMessage('cid-c1', theirs.id);
    await flush();
    expect(s.getState().pending).toBeNull();
    expect(msgs('cid-c1').some((m) => m.id === theirs.id)).toBe(true);
  });

  it('a second destructive action closes the first window now (one toast at a time)', async () => {
    const s = createChatStore(port);
    const mine = msgs('cid-c1').filter((m) => m.from === 'trainer');
    s.deleteMessage('cid-c1', mine[0].id);
    await flush();
    s.clearChat('cid-c2');
    await flush();
    expect(port.dump('cid-c1').find((m) => m.id === mine[0].id)!.deleted).toBe(true);
    expect(s.getState().pending).toMatchObject({ kind: 'chat', cid: 'cid-c2' });
  });

  it('clear chat is own copy only: the list empties, Undo restores, the data was never deleted', async () => {
    const s = createChatStore(port);
    s.clearChat('cid-c2');
    await flush();
    expect(msgs('cid-c2')).toEqual([]);
    expect(s.getState().pending?.kind).toBe('chat');
    s.undo();
    await flush();
    expect(msgs('cid-c2').length).toBeGreaterThan(10);
    s.clearChat('cid-c2');
    await flush();
    await vi.advanceTimersByTimeAsync(UNDO_MS + 50);
    expect(msgs('cid-c2')).toEqual([]);
    expect(port.dump('cid-c2').length).toBeGreaterThan(10); // the other person keeps his copy
  });

  it('a new message after a clear shows again; unread counts only what is visible', async () => {
    const s = createChatStore(port);
    s.retain('t');
    s.clearChat('cid-c2');
    await flush();
    expect(s.getState().threads.find((t) => t.cid === 'cid-c2')).toMatchObject({
      unread: 0,
      preview: null,
    });
    await vi.advanceTimersByTimeAsync(10);
    port.receive('cid-c2', 'Hi again');
    expect(s.getState().threads.find((t) => t.cid === 'cid-c2')).toMatchObject({
      unread: 1,
      preview: 'Hi again',
    });
  });
});
