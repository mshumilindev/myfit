import { describe, expect, it } from 'vitest';
import { unsyncedCount } from '../../../unsynced';
import { createClientChatStore } from './chatStore';
import type { ClientChatPort } from './chatPort';

// SPO-384: a message that has not been delivered is an unsent change sign-out must wait for (and count).
const port = (send: ClientChatPort['send']): ClientChatPort => ({
  now: () => 1,
  subscribe: () => () => undefined,
  subscribeUnread: () => () => undefined,
  send,
  markRead: async () => undefined,
  softDelete: async () => undefined,
  undoDelete: async () => undefined,
  commitDelete: async () => undefined,
  clearChat: async () => ({ previous: 0 }),
  undoClear: async () => undefined,
});

describe('client chat outbox and sign-out', () => {
  it('an undelivered message counts as unsent until it goes out', async () => {
    let release!: () => void;
    const s = createClientChatStore(port(() => new Promise<void>((r) => (release = r))));
    s.send('c1', 'hello');
    expect(unsyncedCount()).toBe(1);
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(unsyncedCount()).toBe(0);
  });
  it('a message that failed stays counted (it would be lost with the device data)', async () => {
    const s = createClientChatStore(port(() => Promise.reject(new Error('offline'))));
    s.send('c1', 'hello');
    await new Promise((r) => setTimeout(r, 0));
    expect(unsyncedCount()).toBe(1);
  });
});
