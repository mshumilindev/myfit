import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecisionRecord, type DecisionRecordProps } from './DecisionRecord';

afterEach(cleanup);

const base: DecisionRecordProps = {
  avatar: <span />,
  name: 'Oleh Bondar',
  sub: 'Upper/Lower 4x · decided 16 Sep',
  result: { label: 'No clear change', tone: 'neutral' },
  stepsLabel: 'How the decision went',
  steps: [
    { id: 'a', icon: 'pulse', title: 'What happened', body: 'Stall' },
    { id: 'b', icon: 'target', title: 'Result', body: 'Unchanged' },
  ],
  followUp: {
    title: '14-day follow-up',
    status: 'Closed',
    value: 100,
    tone: 'ok',
    progressLabel: 'Days measured so far',
    notes: ['Saved as it was when you decided.'],
  },
  footnote: 'Oleh sees the decision and its result, never your private notes.',
};

describe('DecisionRecord', () => {
  it('renders the steps as an ordered list with their titles', () => {
    render(<DecisionRecord {...base} />);
    const list = screen.getByRole('list', { name: 'How the decision went' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('No clear change')).toBeTruthy();
    expect(screen.getByRole('region', { name: '14-day follow-up' })).toBeTruthy();
  });
  it('the name is a button only when it can open the client', () => {
    const open = vi.fn();
    const { rerender } = render(<DecisionRecord {...base} />);
    expect(screen.queryByRole('button', { name: /Oleh Bondar/ })).toBeNull();
    rerender(<DecisionRecord {...base} onOpenClient={open} />);
    fireEvent.click(screen.getByRole('button', { name: /Oleh Bondar/ }));
    expect(open).toHaveBeenCalled();
  });
  it('no follow-up block and no actions when not given', () => {
    render(<DecisionRecord {...base} followUp={undefined} footnote={undefined} />);
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByText(/private notes/)).toBeNull();
  });
});
