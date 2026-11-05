// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkSearchField } from './SkSearchField';

afterEach(cleanup);

describe('SkSearchField', () => {
  it('is a labelled search input without clear when empty', () => {
    render(<SkSearchField value="" placeholder="Search" clearLabel="Clear" onClear={() => {}} />);
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('reports typing and focus', () => {
    const onChange = vi.fn();
    const onFocus = vi.fn();
    render(<SkSearchField value="" placeholder="Search" onChange={onChange} onFocus={onFocus} />);
    const i = screen.getByRole('searchbox');
    fireEvent.focus(i);
    fireEvent.change(i, { target: { value: 'sl' } });
    expect(onFocus).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith('sl');
  });
  it('shows an active class and a working clear button with text', () => {
    const onClear = vi.fn();
    const { container } = render(
      <SkSearchField
        value="sleep"
        placeholder="Search"
        clearLabel="Clear search"
        onClear={onClear}
      />,
    );
    expect(container.querySelector('label')?.className).toContain('sk-on');
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
  it('supports autofocus', () => {
    render(<SkSearchField value="" placeholder="Search" autoFocus />);
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
  });
});
