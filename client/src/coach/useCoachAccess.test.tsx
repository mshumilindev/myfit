import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const state = vi.hoisted(() => ({ role: 'member', flag: false }));
vi.mock('../api', () => ({ getRole: () => state.role }));
vi.mock('../data/flags', () => ({ useFlag: () => state.flag }));

import { useCoachAccess } from './useCoachAccess';

describe('useCoachAccess matrix (role x flag)', () => {
  it.each([
    ['member', false, false],
    ['member', true, false],
    ['trainer', false, false],
    ['trainer', true, true],
    ['admin', false, false],
    ['admin', true, true],
  ] as const)('%s, flag %s -> %s', (role, flag, expected) => {
    state.role = role;
    state.flag = flag;
    expect(renderHook(() => useCoachAccess()).result.current).toBe(expected);
  });
});
