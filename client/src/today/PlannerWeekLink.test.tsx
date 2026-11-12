import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({
  host: null as null | { todayLine: (now: number, l: string) => string | null },
}));
vi.mock('../plannerRt', () => ({ usePlannerHost: () => state.host }));

import { PlannerWeekLink } from './PlannerWeekLink';

afterEach(cleanup);

describe('PlannerWeekLink', () => {
  it('shows nothing while Planner is not installed or not loaded', () => {
    state.host = null;
    const { container } = render(<PlannerWeekLink now={0} onOpen={() => {}} />);
    expect(container.textContent).toBe('');
  });
  it('shows nothing when no plan is left today', () => {
    state.host = { todayLine: () => null };
    const { container } = render(<PlannerWeekLink now={0} onOpen={() => {}} />);
    expect(container.textContent).toBe('');
  });
  it('shows the line and opens the Planner', () => {
    state.host = { todayLine: () => 'Planner · 2 today' };
    const open = vi.fn();
    render(<PlannerWeekLink now={0} onOpen={open} />);
    fireEvent.click(screen.getByRole('button', { name: /Planner · 2 today/ }));
    expect(open).toHaveBeenCalled();
  });
});
