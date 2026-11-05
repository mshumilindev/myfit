import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { currentHash, setHash } from '../route';
import { useStoreOpen } from './useStoreOpen';

beforeEach(() => setHash('#/store', true));
afterEach(cleanup);

describe('useStoreOpen', () => {
  it('is open for a member and follows the address', () => {
    const { result } = renderHook(() => useStoreOpen(true, 'member'));
    expect(result.current).toBe(true);
    act(() => setHash('#/today'));
    expect(result.current).toBe(false);
  });
  it('sends a manager to Today instead of opening the store', () => {
    const { result } = renderHook(() => useStoreOpen(true, 'manager'));
    expect(result.current).toBe(false);
    expect(currentHash()).toMatch(/today/);
  });
  it('stays closed while signed out', () => {
    const { result } = renderHook(() => useStoreOpen(false, 'member'));
    expect(result.current).toBe(false);
  });
});
