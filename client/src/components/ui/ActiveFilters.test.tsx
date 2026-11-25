import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActiveFilters } from './ActiveFilters';

afterEach(cleanup);

const text = {
  groupLabel: 'Active filters',
  clearLabel: 'Clear all',
  removeLabel: (l: string) => `Remove ${l}`,
};
const items = [
  { id: 'a', label: 'Beginner' },
  { id: 'b', label: 'Full gym' },
];

describe('ActiveFilters', () => {
  it('renders nothing when no filter is on', () => {
    const { container } = render(<ActiveFilters items={[]} {...text} onClear={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('is a named group with a removable chip per filter', () => {
    render(<ActiveFilters items={items} {...text} />);
    expect(screen.getByRole('group', { name: 'Active filters' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Beginner' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Full gym' })).toBeTruthy();
  });

  it('reports the removed id', () => {
    const onRemove = vi.fn();
    render(<ActiveFilters items={items} {...text} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Full gym' }));
    expect(onRemove).toHaveBeenCalledWith('b');
  });

  it('shows Clear all only when onClear is given, and calls it', () => {
    const { rerender } = render(<ActiveFilters items={items} {...text} />);
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
    const onClear = vi.fn();
    rerender(<ActiveFilters items={items} {...text} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
