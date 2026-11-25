import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FilterGroup } from './FilterGroup';

afterEach(cleanup);

const options = [
  { id: 'a', label: 'Beginner', count: 3 },
  { id: 'b', label: 'Advanced', count: 2 },
  { id: 'c', label: 'Elite', count: 0 },
];

describe('FilterGroup', () => {
  it('is a fieldset named by its label with one chip per option', () => {
    render(<FilterGroup label="Level" options={options} active={[]} />);
    expect(screen.getByRole('group', { name: 'Level' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('reports the toggled id and reflects the active ones', () => {
    const onToggle = vi.fn();
    render(<FilterGroup label="Level" options={options} active={['a']} onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Beginner' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Advanced' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(onToggle).toHaveBeenCalledWith('b');
  });

  it('disables an option that matches nothing', () => {
    const onToggle = vi.fn();
    render(<FilterGroup label="Level" options={options} active={[]} onToggle={onToggle} />);
    const elite = screen.getByRole('button', { name: 'Elite' }) as HTMLButtonElement;
    expect(elite.disabled).toBe(true);
    fireEvent.click(elite);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('keeps an option that is on enabled even at zero matches, so it can be turned off', () => {
    render(<FilterGroup label="Level" options={options} active={['c']} />);
    expect((screen.getByRole('button', { name: 'Elite' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('treats a missing count as available', () => {
    render(<FilterGroup label="Era" options={[{ id: 'x', label: 'Modern' }]} active={[]} />);
    expect((screen.getByRole('button', { name: 'Modern' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
