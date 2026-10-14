// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  createUnreadStore,
  sumUnread,
  unreadFromConversations,
  type ConversationUnreadDoc,
  type ConversationsPort,
} from './unreadStore';

const doc = (
  clientId: string,
  unread: Record<string, number> | undefined,
  o: Partial<ConversationUnreadDoc> = {},
): ConversationUnreadDoc => ({
  cid: `cid-${clientId}`,
  clientId,
  trainerId: 't1',
  active: true,
  unread,
  ...o,
});

describe('unreadFromConversations', () => {
  it('maps the trainer counter per client and sums the total', () => {
    const r = unreadFromConversations('t1', [
      doc('c1', { t1: 3, c1: 9 }),
      doc('c2', { t1: 12 }),
      doc('c3', { t1: 1 }),
      doc('c4', { t1: 0 }),
      doc('c5', undefined),
    ]);
    expect(r.byClient).toEqual({ c1: 3, c2: 12, c3: 1 });
    expect(r.total).toBe(16);
  });
  it('ignores ended conversations, other trainers, junk and the client side counter', () => {
    const r = unreadFromConversations('t1', [
      doc('a', { t1: 5 }, { active: false }),
      doc('b', { t1: 5 }, { trainerId: 't2' }),
      doc('c', { t1: -3 }),
      doc('d', { t1: Number.NaN }),
      doc('e', { t1: '4' as unknown as number }),
      doc('f', { c: 5 }),
      doc('', { t1: 5 }),
      doc('g', { t1: 2.9 }),
    ]);
    expect(r).toEqual({ total: 2, byClient: { g: 2 } });
  });
  it('admin = coach: the same query with the admin uid', () => {
    expect(
      unreadFromConversations('admin-1', [doc('c1', { 'admin-1': 4 }, { trainerId: 'admin-1' })])
        .total,
    ).toBe(4);
  });
  it('sumUnread ignores junk', () => {
    expect(sumUnread({ a: 3, b: 0, c: 20 })).toBe(23);
    expect(sumUnread({ a: -4, b: Number.NaN, c: 2.9 })).toBe(2);
  });
});

describe('createUnreadStore', () => {
  function port() {
    let push: (d: ConversationUnreadDoc[]) => void = () => undefined;
    let fail: (e: unknown) => void = () => undefined;
    const off = vi.fn();
    const subscribe = vi.fn(
      (_uid: string, ok: (d: ConversationUnreadDoc[]) => void, err: (e: unknown) => void) => {
        push = ok;
        fail = err;
        return off;
      },
    );
    const p: ConversationsPort = { subscribe };
    return {
      p,
      subscribe,
      off,
      push: (d: ConversationUnreadDoc[]) => push(d),
      fail: (e: unknown) => fail(e),
    };
  }

  it('starts at 0 (no badge), never blocks, updates live and notifies only on change', () => {
    const x = port();
    const s = createUnreadStore(x.p, 't1');
    const seen = vi.fn();
    s.subscribe(seen);
    expect(s.getState().total).toBe(0);
    s.start();
    s.start();
    expect(x.subscribe).toHaveBeenCalledTimes(1);
    x.push([doc('c1', { t1: 3 })]);
    expect(s.getState()).toEqual({ total: 3, byClient: { c1: 3 } });
    x.push([doc('c1', { t1: 3 })]);
    expect(seen).toHaveBeenCalledTimes(1);
    x.push([doc('c1', { t1: 0 })]);
    expect(s.getState().total).toBe(0);
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('a listener error keeps the last counts', () => {
    const x = port();
    const s = createUnreadStore(x.p, 't1');
    s.start();
    x.push([doc('c1', { t1: 2 })]);
    x.fail(new Error('permission-denied'));
    expect(s.getState().total).toBe(2);
  });

  it('no uid: nothing is subscribed; stop() unsubscribes', () => {
    const x = port();
    createUnreadStore(x.p, null).start();
    expect(x.subscribe).not.toHaveBeenCalled();
    const s = createUnreadStore(x.p, 't1');
    s.start();
    s.stop();
    expect(x.off).toHaveBeenCalledTimes(1);
  });
});
