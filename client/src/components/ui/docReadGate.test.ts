import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptBoxesEnabled,
  allDocsOpened,
  canAccept,
  clearDocRead,
  useDocReadGate,
} from './docReadGate';

describe('read-and-accept rule', () => {
  it('Accept needs every document opened AND every box ticked', () => {
    expect(canAccept(false, [true, true])).toBe(false);
    expect(canAccept(true, [true, false])).toBe(false);
    expect(canAccept(true, [false, false])).toBe(false);
    expect(canAccept(true, [true, true])).toBe(true);
  });
  it('the boxes unlock only after the documents were opened', () => {
    expect(acceptBoxesEnabled(false)).toBe(false);
    expect(acceptBoxesEnabled(true)).toBe(true);
  });
  it('allDocsOpened checks each id; an empty list is vacuously open', () => {
    expect(allDocsOpened(['a', 'b'], { a: true })).toBe(false);
    expect(allDocsOpened(['a', 'b'], { a: true, b: true })).toBe(true);
    expect(allDocsOpened([], {})).toBe(true);
  });
});

describe('useDocReadGate', () => {
  const ids = ['terms', 'privacy'];
  it('starts closed and opens one by one', () => {
    const { result } = renderHook(() => useDocReadGate(ids));
    expect(result.current.opened).toEqual({ terms: false, privacy: false });
    expect(result.current.allOpened).toBe(false);
    act(() => result.current.markOpened('terms'));
    expect(result.current.opened).toEqual({ terms: true, privacy: false });
    expect(result.current.allOpened).toBe(false);
    act(() => result.current.markOpened('privacy'));
    expect(result.current.allOpened).toBe(true);
  });
  it('ignores unknown ids and repeats', () => {
    const { result } = renderHook(() => useDocReadGate(ids));
    act(() => result.current.markOpened('nope'));
    expect(result.current.opened).toEqual({ terms: false, privacy: false });
    act(() => result.current.markOpened('terms'));
    const first = result.current.opened;
    act(() => result.current.markOpened('terms'));
    expect(result.current.opened).toBe(first);
  });
  it('keeps no storage: a fresh mount starts closed again', () => {
    const before = JSON.stringify([{ ...localStorage }, { ...sessionStorage }]);
    const a = renderHook(() => useDocReadGate(ids));
    act(() => a.result.current.markOpened('terms'));
    a.unmount();
    const b = renderHook(() => useDocReadGate(ids));
    expect(b.result.current.opened.terms).toBe(false);
    expect(JSON.stringify([{ ...localStorage }, { ...sessionStorage }])).toBe(before);
  });
});

describe('useDocReadGate with versions (survives a same-tab remount)', () => {
  const ids = ['terms', 'privacy'];
  const v = { terms: '2026-10-21', privacy: '2026-10-21' };
  beforeEach(() => sessionStorage.clear());

  it('keeps what was opened across an unmount per document and version', () => {
    const a = renderHook(() => useDocReadGate(ids, v));
    act(() => a.result.current.markOpened('terms'));
    a.unmount();
    const b = renderHook(() => useDocReadGate(ids, v));
    expect(b.result.current.opened).toEqual({ terms: true, privacy: false });
  });
  it('a new document version starts closed again', () => {
    const a = renderHook(() => useDocReadGate(ids, v));
    act(() => a.result.current.markOpened('terms'));
    a.unmount();
    const b = renderHook(() => useDocReadGate(ids, { ...v, terms: '2026-11-01' }));
    expect(b.result.current.opened.terms).toBe(false);
  });
  it('clearDocRead resets the marks (on grant)', () => {
    const a = renderHook(() => useDocReadGate(ids, v));
    act(() => a.result.current.markOpened('terms'));
    a.unmount();
    clearDocRead(ids, v);
    const b = renderHook(() => useDocReadGate(ids, v));
    expect(b.result.current.opened.terms).toBe(false);
  });
  it('works in memory when sessionStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const a = renderHook(() => useDocReadGate(ids, v));
    act(() => a.result.current.markOpened('terms'));
    expect(a.result.current.opened.terms).toBe(true);
    spy.mockRestore();
    get.mockRestore();
  });
});
