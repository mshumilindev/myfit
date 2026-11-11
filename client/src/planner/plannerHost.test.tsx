import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import { useCommonMoreItems } from '../components/suite/commonMore';
import { usePlannerHost } from '../plannerRt';

beforeEach(() => addonsPref.reset());

describe('Planner: nothing shows until it is installed (SPO-552 I1)', () => {
  it('not installed: no host and no More row, even if its chunk was loaded before', async () => {
    await import('./plannerBoot');
    const host = renderHook(() => usePlannerHost());
    expect(host.result.current).toBeNull();
    const more = renderHook(() => useCommonMoreItems());
    expect(more.result.current.map((i) => i.id)).not.toContain('planner');
  });
  it('installed: the host and one plain More row appear; removing hides them at once', async () => {
    await import('./plannerBoot');
    addonsPref.set(['planner']);
    const more = renderHook(() => useCommonMoreItems());
    expect(more.result.current.filter((i) => i.id === 'planner')).toHaveLength(1);
    const host = renderHook(() => usePlannerHost());
    expect(host.result.current?.Page).toBeTruthy();
    act(() => addonsPref.reset());
    expect(host.result.current).toBeNull();
    expect(more.result.current.map((i) => i.id)).not.toContain('planner');
  });
  it('the screen shows the empty state', async () => {
    await import('./plannerBoot');
    addonsPref.set(['planner']);
    const { result } = renderHook(() => usePlannerHost());
    const Page = result.current!.Page!;
    render(<Page onClose={() => undefined} />);
    expect(screen.getByText('No plans yet')).toBeTruthy();
  });
});
