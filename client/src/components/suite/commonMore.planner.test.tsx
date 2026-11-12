import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const open = vi.fn();
vi.mock('../../plannerRt', () => ({
  usePlannerHost: () => ({
    moreItem: (_l: string, go: () => void) => ({
      id: 'planner',
      icon: 'calendar',
      label: 'Planner',
      onSelect: () => {
        open();
        go();
      },
    }),
  }),
}));
vi.mock('../../route', () => ({ setHash: vi.fn() }));

import { setHash } from '../../route';
import { useCommonMoreItems } from './commonMore';

describe('More: Planner row', () => {
  it('the row opens #/planner', () => {
    const { result } = renderHook(() => useCommonMoreItems());
    const row = result.current.find((i) => i.id === 'planner');
    expect(row).toBeTruthy();
    row?.onSelect();
    expect(open).toHaveBeenCalledOnce();
    expect(setHash).toHaveBeenCalledWith('#/planner');
  });
});
