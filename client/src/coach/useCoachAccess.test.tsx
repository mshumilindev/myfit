import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const state = vi.hoisted(() => ({ role: 'member' }));
vi.mock('../api', () => ({ getRole: () => state.role }));

import { useCoachAccess } from './useCoachAccess';

describe('useCoachAccess (role only, no feature flag)', () => {
  it.each([
    ['member', false],
    ['trainer', true],
    ['admin', true],
  ] as const)('%s -> %s', (role, expected) => {
    state.role = role;
    expect(renderHook(() => useCoachAccess()).result.current).toBe(expected);
  });
});
