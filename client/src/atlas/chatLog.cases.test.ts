import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'spotter.atlasChat';
const msg = (id: string, extra: object = {}) => ({
  id,
  at: Number(id.replace(/\D/g, '')) || 1,
  from: 'me' as const,
  text: id,
  ...extra,
});

async function fresh() {
  vi.resetModules();
  return import('./chatLog');
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('chat log persistence', () => {
  it('restores the saved thread on load but drops pending messages', async () => {
    localStorage.setItem(KEY, JSON.stringify([msg('a1'), msg('p2', { pending: true }), msg('a3')]));
    const m = await fresh();
    const { result } = renderHook(() => m.useChatLog());
    expect(result.current.map((x) => x.id)).toEqual(['a1', 'a3']);
  });
  it('starts empty on corrupt storage', async () => {
    localStorage.setItem(KEY, '{broken');
    const m = await fresh();
    const { result } = renderHook(() => m.useChatLog());
    expect(result.current).toEqual([]);
  });
});

describe('chat log mutations', () => {
  it('push, update, remove and clear change the log, notify subscribers and persist without pending', async () => {
    const m = await fresh();
    const { result } = renderHook(() => m.useChatLog());
    act(() => m.pushChat(msg('a1')));
    act(() => m.pushChat(msg('a2', { pending: true })));
    expect(result.current.map((x) => x.id)).toEqual(['a1', 'a2']);
    expect(JSON.parse(localStorage.getItem(KEY)!).map((x: { id: string }) => x.id)).toEqual(['a1']);
    act(() => m.updateChat('a2', { pending: false, text: 'done' }));
    expect(result.current[1]).toMatchObject({ id: 'a2', pending: false, text: 'done' });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toHaveLength(2);
    act(() => m.updateChat('missing', { text: 'x' }));
    expect(result.current).toHaveLength(2);
    act(() => m.removeChat('a1'));
    expect(result.current.map((x) => x.id)).toEqual(['a2']);
    act(() => m.clearChat());
    expect(result.current).toEqual([]);
    expect(localStorage.getItem(KEY)).toBe('[]');
  });
  it('keeps only the newest 100 messages', async () => {
    const m = await fresh();
    const { result } = renderHook(() => m.useChatLog());
    act(() => {
      for (let i = 1; i <= 105; i++) m.pushChat(msg(`m${i}`));
    });
    expect(result.current).toHaveLength(100);
    expect(result.current[0].id).toBe('m6');
    expect(result.current[99].id).toBe('m105');
  });
  it('stops notifying an unmounted subscriber', async () => {
    const m = await fresh();
    const { result, unmount } = renderHook(() => m.useChatLog());
    unmount();
    const before = result.current;
    act(() => m.pushChat(msg('a1')));
    expect(result.current).toBe(before);
  });
  it('keeps the chat in memory when storage refuses writes', async () => {
    const m = await fresh();
    const { result } = renderHook(() => m.useChatLog());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    act(() => m.pushChat(msg('a1')));
    expect(result.current.map((x) => x.id)).toEqual(['a1']);
  });
});

describe('intro flag', () => {
  it('is unseen on a clean device', async () => {
    expect((await fresh()).introSeen()).toBe(false);
  });
  it('markIntroSeen sticks', async () => {
    const m = await fresh();
    m.markIntroSeen();
    expect(m.introSeen()).toBe(true);
    expect(localStorage.getItem('spotter.atlasIntroSeen')).toBe('1');
  });
  it('a chat that began before the flag existed counts as seen (hello in the log)', async () => {
    localStorage.setItem(KEY, JSON.stringify([msg('a1', { hello: true })]));
    expect((await fresh()).introSeen()).toBe(true);
  });
  it('a chat without a hello does not', async () => {
    localStorage.setItem(KEY, JSON.stringify([msg('a1')]));
    expect((await fresh()).introSeen()).toBe(false);
  });
  it('survives storage errors on read (falls back to the log) and write', async () => {
    const m = await fresh();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(m.introSeen()).toBe(false);
    expect(() => m.markIntroSeen()).not.toThrow();
  });
});
