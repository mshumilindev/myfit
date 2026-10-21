import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NOTIF_INIT_KEY,
  isSeen,
  markAllNotifsSeen,
  markNotifsSeen,
  syncNotifs,
  unreadCount,
  useNotifs,
  type Notif,
} from './notifications';

const n = (id: string, ts: number, title = id): Notif => ({
  id,
  kind: 'pr',
  ts,
  title,
  subtitle: 's',
});

// The store is module state (first-run flag, snapshot), so these tests are ORDERED: each one
// continues from the state the previous left, and uses its own ids.
afterEach(cleanup);

describe('reactive notification store (ordered)', () => {
  it('1. the very first sync baselines the history as read and records the init flag', () => {
    expect(localStorage.getItem(NOTIF_INIT_KEY)).toBeNull();
    const { result } = renderHook(() => useNotifs());
    expect(result.current.notifs).toEqual([]);
    act(() => syncNotifs([n('a', 1), n('b', 2)]));
    expect(result.current.notifs.map((x) => x.id)).toEqual(['b', 'a']);
    expect(unreadCount(result.current.state, result.current.notifs)).toBe(0);
    expect(localStorage.getItem(NOTIF_INIT_KEY)).toBe('1');
  });

  it('2. later events are unread; marking them read is persisted', () => {
    const { result } = renderHook(() => useNotifs());
    act(() => syncNotifs([n('a', 1), n('b', 2), n('c', 5), n('d', 6)]));
    expect(unreadCount(result.current.state, result.current.notifs)).toBe(2);
    act(() => markNotifsSeen(['c']));
    expect(unreadCount(result.current.state, result.current.notifs)).toBe(1);
    expect(isSeen(result.current.state, 'c')).toBe(true);
    expect(JSON.parse(localStorage.getItem('spotter.notif.state')!)).toMatchObject({
      c: { ts: 5, seen: true },
      d: { ts: 6, seen: false },
    });
  });

  it('3. markAllNotifsSeen reads everything; repeating it or marking read ids does not re-render', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useNotifs();
    });
    act(() => markAllNotifsSeen());
    expect(unreadCount(result.current.state, result.current.notifs)).toBe(0);
    const before = renders;
    act(() => markAllNotifsSeen());
    act(() => markNotifsSeen(['a', 'd']));
    act(() => markNotifsSeen(['unknown']));
    expect(renders).toBe(before);
  });

  it('4. an identical sync keeps the snapshot; a text-only change (language switch) emits a new one', () => {
    const { result } = renderHook(() => useNotifs());
    act(() => syncNotifs([n('e', 10, 'Bench PR')]));
    const snap = result.current;
    act(() => syncNotifs([n('e', 10, 'Bench PR')]));
    expect(result.current).toBe(snap);
    act(() => syncNotifs([n('e', 10, 'Жим PR')]));
    expect(result.current).not.toBe(snap);
    expect(result.current.notifs[0].title).toBe('Жим PR');
  });

  it('5. an event leaving the feed re-emits; a throwing storage never breaks sync', () => {
    const { result } = renderHook(() => useNotifs());
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    act(() => syncNotifs([n('e', 10, 'Жим PR'), n('f', 11)]));
    expect(result.current.notifs.map((x) => x.id)).toEqual(['f', 'e']);
    expect(() => act(() => syncNotifs([n('f', 11)]))).not.toThrow();
    expect(result.current.notifs.map((x) => x.id)).toEqual(['f']);
    expect(() => act(() => markNotifsSeen(['f']))).not.toThrow();
    setItem.mockRestore();
  });

  it('6. an unseen flag that flips with the same feed text still emits', () => {
    const { result } = renderHook(() => useNotifs());
    act(() => syncNotifs([n('f', 11), n('g', 12)]));
    expect(isSeen(result.current.state, 'g')).toBe(false);
    const snap = result.current;
    act(() => markNotifsSeen(['g']));
    expect(result.current).not.toBe(snap);
    expect(isSeen(result.current.state, 'g')).toBe(true);
  });
});
