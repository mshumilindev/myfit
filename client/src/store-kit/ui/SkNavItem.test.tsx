// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkNavItem } from './SkNavItem';

afterEach(cleanup);

describe('SkNavItem', () => {
  it('marks the active item with aria-current and a class', () => {
    render(<SkNavItem label="Apps" active />);
    const b = screen.getByRole('button', { name: 'Apps' });
    expect(b.getAttribute('aria-current')).toBe('page');
    expect(b.className).toContain('sk-nvi-on');
  });
  it('has no aria-current when inactive and fires onClick', () => {
    const on = vi.fn();
    render(<SkNavItem label="Apps" onClick={on} />);
    const b = screen.getByRole('button');
    expect(b.getAttribute('aria-current')).toBeNull();
    fireEvent.click(b);
    expect(on).toHaveBeenCalledTimes(1);
  });
  it('shows the count chip only for positive counts and caps at 99+', () => {
    const { rerender, container } = render(<SkNavItem label="x" count={0} />);
    expect(container.querySelector('.sk-nvi-cnt')).toBeNull();
    rerender(<SkNavItem label="x" count={4} />);
    expect(container.querySelector('.sk-nvi-cnt')?.textContent).toBe('4');
    rerender(<SkNavItem label="x" count={250} />);
    expect(container.querySelector('.sk-nvi-cnt')?.textContent).toBe('99+');
  });
});
