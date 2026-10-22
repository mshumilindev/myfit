import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StepList, type StepItem } from './StepList';

afterEach(cleanup);

const items: StepItem[] = [
  { id: 'program', icon: 'barbell', title: 'Program', body: 'Starts Monday' },
  { id: 'msg', icon: 'chat', title: 'Message to Oleh', body: <textarea aria-label="Edit" /> },
];

describe('StepList', () => {
  it('renders a labelled list with one item per step', () => {
    render(<StepList items={items} label="What happens next" />);
    expect(screen.getByRole('list', { name: 'What happens next' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows title and body text for each step', () => {
    render(<StepList items={items} label="L" />);
    expect(screen.getByText('Program').className).toBe('uisteplist-title');
    expect(screen.getByText('Starts Monday').className).toBe('uisteplist-body');
  });

  it('allows block content in the body', () => {
    render(<StepList items={items} label="L" />);
    const ta = screen.getByRole('textbox', { name: 'Edit' });
    expect(ta.closest('.uisteplist-body')).not.toBeNull();
  });

  it('renders an icon tile per row', () => {
    const { container } = render(<StepList items={items} label="L" />);
    const rows = container.querySelectorAll('.uisteplist-row');
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.querySelector('.ui-icon')).not.toBeNull();
  });

  it('renders an empty list for no items', () => {
    render(<StepList items={[]} label="L" />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
