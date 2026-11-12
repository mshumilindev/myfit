import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TimeRangeRow } from './TimeRangeRow';

describe('TimeRangeRow', () => {
  it('shows both ends on one row and taps each separately', () => {
    const onFrom = vi.fn();
    const onTo = vi.fn();
    render(
      <TimeRangeRow
        fromLabel="From"
        toLabel="To"
        from="09:00"
        to="10:30"
        onFrom={onFrom}
        onTo={onTo}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /From.*09:00/ }));
    expect(onFrom).toHaveBeenCalledTimes(1);
    expect(onTo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /To.*10:30/ }));
    expect(onTo).toHaveBeenCalledTimes(1);
  });
});
