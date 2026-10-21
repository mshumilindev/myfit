/**
 * Composer drafts: memory first, a sealed copy on the device when the vault has a key; an empty draft removes the copy.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSealedLocal,
  memoryBackend,
  configureSealedLocal,
  type SealedLocal,
} from './sealedLocal';
import { createDraftStore, draftStore, resetDraftStore, useDraft } from './chatDrafts';
import { readyVault } from '../../testVault';

let backend: ReturnType<typeof memoryBackend>;
let local: SealedLocal;
beforeEach(async () => {
  backend = memoryBackend();
  local = createSealedLocal({ vault: await readyVault(), backend });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  configureSealedLocal(null);
  resetDraftStore();
});

describe('draft store', () => {
  it('get/set keep one draft per conversation, notify once per real change, snapshot is stable until then', () => {
    const s = createDraftStore();
    const f = vi.fn();
    const off = s.subscribe(f);
    const snap0 = s.snapshot();
    expect(s.get('a')).toBe('');
    s.set('a', '');
    expect(f).not.toHaveBeenCalled();
    expect(s.snapshot()).toBe(snap0);
    s.set('a', 'hello');
    s.set('a', 'hello');
    s.set('b', 'other');
    expect(f).toHaveBeenCalledTimes(2);
    expect(s.get('a')).toBe('hello');
    expect(s.snapshot()).toEqual({ a: 'hello', b: 'other' });
    off();
    s.set('a', 'x');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('with a sealed store attached the draft is saved encrypted after a pause, the last text wins', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const s = createDraftStore();
    s.attach(local);
    s.set('cid-1', 'my kn');
    await vi.advanceTimersByTimeAsync(300);
    s.set('cid-1', 'my knee hurts SECRET-DRAFT');
    await vi.advanceTimersByTimeAsync(599);
    expect(await backend.keys()).toEqual([]);
    await vi.advanceTimersByTimeAsync(5);
    // the sealing itself is real (async) crypto: wait for it instead of guessing a delay
    await vi.waitFor(async () => expect(await backend.keys()).toEqual(['draft:cid-1']));
    expect(JSON.stringify(await backend.get('draft:cid-1'))).not.toContain('SECRET-DRAFT');
    expect(await local.get('draft:cid-1')).toBe('my knee hurts SECRET-DRAFT');
  });

  it('emptying the draft deletes the stored copy; without a sealed store nothing is stored at all', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const s = createDraftStore();
    s.attach(local);
    s.set('cid-1', 'abc');
    await vi.advanceTimersByTimeAsync(700);
    await vi.waitFor(async () => expect(await backend.keys()).toEqual(['draft:cid-1']));
    s.set('cid-1', '');
    await vi.advanceTimersByTimeAsync(700);
    await vi.waitFor(async () => expect(await backend.keys()).toEqual([]));

    const bare = createDraftStore();
    bare.set('cid-2', 'zzz');
    await vi.advanceTimersByTimeAsync(700);
    expect(await backend.keys()).toEqual([]);
    expect(bare.get('cid-2')).toBe('zzz');
  });

  it('load restores the sealed copy unless something was typed meanwhile or there is no store', async () => {
    await local.set('draft:cid-1', 'saved text');
    const s = createDraftStore();
    await s.load('cid-1'); // no store attached: nothing
    expect(s.get('cid-1')).toBe('');
    s.attach(local);
    const f = vi.fn();
    s.subscribe(f);
    await s.load('cid-1');
    expect(s.get('cid-1')).toBe('saved text');
    expect(f).toHaveBeenCalledTimes(1);
    // typed text is never overwritten
    s.set('cid-3', 'typed');
    await local.set('draft:cid-3', 'older');
    await s.load('cid-3');
    expect(s.get('cid-3')).toBe('typed');
    // a missing or non-string or empty stored value changes nothing
    await local.set('draft:cid-4', 42);
    await local.set('draft:cid-5', '');
    await s.load('cid-4');
    await s.load('cid-5');
    await s.load('cid-none');
    expect(s.snapshot()).toEqual({ 'cid-1': 'saved text', 'cid-3': 'typed' });
  });

  it('typing during the read wins over the late sealed copy', async () => {
    let release!: (v: string) => void;
    const slow = {
      ...local,
      get: () => new Promise((r) => (release = r as never)),
    } as unknown as SealedLocal;
    const s = createDraftStore();
    s.attach(slow);
    const p = s.load('cid-1');
    s.set('cid-1', 'fresh');
    release('stale');
    await p;
    expect(s.get('cid-1')).toBe('fresh');
  });

  it('the shared store is one instance until reset', () => {
    const a = draftStore();
    expect(draftStore()).toBe(a);
    resetDraftStore();
    expect(draftStore()).not.toBe(a);
  });
});

describe('useDraft', () => {
  it('without a conversation the draft is empty and the setter does nothing', () => {
    const s = createDraftStore();
    const { result } = renderHook(() => useDraft(null, s));
    expect(result.current[0]).toBe('');
    act(() => void result.current[1]('ignored'));
    expect(s.snapshot()).toEqual({});
  });

  it('without IndexedDB or a sealed store it is memory only but still shared', () => {
    vi.stubGlobal('indexedDB', undefined);
    const s = createDraftStore();
    const { result } = renderHook(() => useDraft('cid-1', s));
    act(() => void result.current[1]('typed'));
    expect(result.current[0]).toBe('typed');
    expect(s.get('cid-1')).toBe('typed');
  });

  it('loads the sealed copy when the conversation opens and again when a locked vault unlocks', async () => {
    vi.stubGlobal('indexedDB', undefined);
    configureSealedLocal(local);
    await local.set('draft:cid-1', 'from disk');
    const s = createDraftStore();
    const { result, unmount } = renderHook(() => useDraft('cid-1', s));
    await vi.waitFor(() => expect(result.current[0]).toBe('from disk'));
    // another conversation, later: arrives through the unlock subscription path too
    await local.set('draft:cid-2', 'second');
    const r2 = renderHook(() => useDraft('cid-2', s));
    await vi.waitFor(() => expect(r2.result.current[0]).toBe('second'));
    unmount();
    r2.unmount();
  });

  it('a vault that unlocks later restores the draft then; unmounting before the store opens attaches nothing', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const listeners: Array<() => void> = [];
    configureSealedLocal({
      ...local,
      subscribe: (f: () => void) => (listeners.push(f), () => void listeners.pop()),
    });
    const s = createDraftStore();
    const attach = vi.spyOn(s, 'attach');
    const { result, unmount } = renderHook(() => useDraft('cid-7', s));
    await vi.waitFor(() => expect(listeners).toHaveLength(1));
    expect(result.current[0]).toBe('');
    await local.set('draft:cid-7', 'after unlock');
    act(() => listeners.forEach((f) => f()));
    await vi.waitFor(() => expect(result.current[0]).toBe('after unlock'));
    unmount();
    expect(listeners).toHaveLength(0);

    const s2 = createDraftStore();
    const attach2 = vi.spyOn(s2, 'attach');
    const r2 = renderHook(() => useDraft('cid-7', s2));
    r2.unmount();
    await new Promise((r) => setTimeout(r, 20));
    expect(attach2).not.toHaveBeenCalled();
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it('a sealed store that cannot be opened leaves the draft working in memory', async () => {
    vi.stubGlobal('indexedDB', {});
    configureSealedLocal(null);
    vi.resetModules();
    const s = createDraftStore();
    const { result } = renderHook(() => useDraft('cid-1', s));
    act(() => void result.current[1]('still works'));
    expect(result.current[0]).toBe('still works');
  });
});
