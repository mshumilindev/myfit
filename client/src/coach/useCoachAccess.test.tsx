import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const state = vi.hoisted(() => ({ role: 'member' }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getRole: () => state.role,
}));

import { addonsPref } from '../addons/enabledSet';
import { useCoachAccess } from './useCoachAccess';

describe('useCoachAccess (role + the Coach app)', () => {
  // Owner rule 07.11: Coach is base for a trainer; an admin has it only once installed from the store.
  it.each([
    ['member', false],
    ['trainer', true],
    ['admin', false],
  ] as const)('%s -> %s', (role, expected) => {
    addonsPref.reset();
    state.role = role;
    expect(renderHook(() => useCoachAccess()).result.current).toBe(expected);
  });
  it('an admin with Coach installed -> true', () => {
    addonsPref.set(['coach']);
    state.role = 'admin';
    expect(renderHook(() => useCoachAccess()).result.current).toBe(true);
  });
});
