// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DropBody, nextDropPart } from './DropBody';

describe('nextDropPart', () => {
  it('a drop loses 2 reps and a quarter of the weight, rounded to 5 kg', () => {
    expect(nextDropPart('drop', { reps: 8, weight: 80 })).toEqual({ reps: 6, weight: 60 });
  });
  it('a reverse drop loses 3 reps and gains 5 kg; never below 1 rep or 0 kg', () => {
    expect(nextDropPart('reverse-drop', { reps: 8, weight: 60 })).toEqual({ reps: 5, weight: 65 });
    expect(nextDropPart('drop', { reps: 2, weight: 2 })).toEqual({ reps: 1, weight: 0 });
  });
  it('keeps bodyweight as bodyweight', () => {
    expect(nextDropPart('drop', { reps: 10, weight: null })).toEqual({ reps: 8, weight: null });
  });
});

describe('DropBody', () => {
  const base = {
    type: 'drop' as const,
    reps: 8,
    weight: 80,
    steppers: () => <div data-testid="part" />,
    firstPart: <div data-testid="first" />,
  };
  it('draws the first part, one row per drop and an add row; add appends a computed part', () => {
    const setDrops = vi.fn();
    render(<DropBody {...base} drops={[{ reps: 6, weight: 60 }]} setDrops={setDrops} />);
    expect(screen.getByTestId('first')).toBeTruthy();
    expect(screen.getAllByTestId('part')).toHaveLength(1);
    fireEvent.click(screen.getByText(/another drop/i));
    const updater = setDrops.mock.calls[0][0] as (
      l: { reps: number; weight: number | null }[],
    ) => unknown;
    expect(updater([{ reps: 6, weight: 60 }])).toEqual([
      { reps: 6, weight: 60 },
      { reps: 4, weight: 45 },
    ]);
  });
  it('shows the reverse note only for a reverse drop', () => {
    const { rerender } = render(<DropBody {...base} drops={[]} setDrops={() => {}} />);
    expect(screen.queryByText(/Reverse means/)).toBeNull();
    rerender(<DropBody {...base} type="reverse-drop" drops={[]} setDrops={() => {}} />);
    expect(screen.getByText(/Reverse means/)).toBeTruthy();
  });
});
