import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configureAvailability,
  readClientAvailability,
  useClientAvailability,
} from './availability';

afterEach(() => configureAvailability(null));

describe('availability slot and hook', () => {
  it('without an adapter nothing is shared', async () => {
    expect(await readClientAvailability('c1')).toEqual({ state: 'not-shared' });
  });
  it('loading, then the answer; a new client loads again', async () => {
    const read = vi.fn(async (id: string) =>
      id === 'c1'
        ? ({ state: 'shared', availability: { weekly: {}, unavailable: [] } } as const)
        : ({ state: 'not-shared' } as const),
    );
    configureAvailability({ read });
    const { result, rerender } = renderHook(({ id }) => useClientAvailability(id), {
      initialProps: { id: 'c1' as string | null },
    });
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('shared'));
    rerender({ id: 'c2' });
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('not-shared'));
    rerender({ id: null });
    expect(result.current.state).toBe('not-shared');
  });
  it('a failure offers retry, and retry reads again', async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce({ state: 'not-shared' });
    configureAvailability({ read });
    const { result } = renderHook(() => useClientAvailability('c1'));
    await waitFor(() => expect(result.current.state).toBe('failed'));
    act(() => {
      if (result.current.state === 'failed') result.current.retry();
    });
    await waitFor(() => expect(result.current.state).toBe('not-shared'));
    expect(read).toHaveBeenCalledTimes(2);
  });
});
