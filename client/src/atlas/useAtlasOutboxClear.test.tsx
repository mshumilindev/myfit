// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sync = vi.fn<(m: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
vi.mock('./schedule', () => ({ syncOutbox: (m: unknown[]) => sync(m) }));
const push = vi.fn(() => 'on');
vi.mock('../push', () => ({ pushState: () => push() }));

import { useAtlasOutboxClear } from './useAtlasOutboxClear';

beforeEach(() => {
  vi.useFakeTimers();
  sync.mockClear();
  push.mockReturnValue('on');
});
afterEach(() => vi.useRealTimers());

describe('useAtlasOutboxClear', () => {
  it('without Atlas, signed in with push on: clears the queued pushes once, after a moment', async () => {
    renderHook(() => useAtlasOutboxClear(false, true));
    expect(sync).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(sync).toHaveBeenCalledWith([]);
  });
  it('does nothing while Atlas is installed, signed out, or push is off', async () => {
    renderHook(() => useAtlasOutboxClear(true, true));
    renderHook(() => useAtlasOutboxClear(false, false));
    push.mockReturnValue('off');
    renderHook(() => useAtlasOutboxClear(false, true));
    await vi.advanceTimersByTimeAsync(5000);
    expect(sync).not.toHaveBeenCalled();
  });
  it('a pending clear is cancelled when the hook goes away', async () => {
    const { unmount } = renderHook(() => useAtlasOutboxClear(false, true));
    unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(sync).not.toHaveBeenCalled();
  });
});
