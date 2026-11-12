import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({ host: null as null | { UpNext: unknown } }));
vi.mock('../plannerRt', () => ({ usePlannerHost: () => state.host }));

import { PlannerEntry } from './PlannerEntry';

afterEach(cleanup);

describe('PlannerEntry', () => {
  it('shows nothing while Planner is not installed or not loaded', () => {
    state.host = null;
    const { container } = render(<PlannerEntry now={0} onOpen={() => {}} />);
    expect(container.textContent).toBe('');
  });
  it('is shown at size M whatever the plans are, and opens the Planner', () => {
    const open = vi.fn();
    state.host = {
      UpNext: ({ size, onOpen }: { size: string; onOpen: () => void }) => (
        <button onClick={onOpen}>entry-{size}</button>
      ),
    };
    render(<PlannerEntry now={0} onOpen={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'entry-M' }));
    expect(open).toHaveBeenCalled();
  });
});
