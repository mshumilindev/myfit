// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkRow } from './SkRow';

afterEach(cleanup);

describe('SkRow', () => {
  it('renders every slot', () => {
    render(
      <SkRow
        tile={<i data-testid="tile" />}
        name="Health"
        desc="Sleep"
        badge={<b data-testid="badge" />}
        rel="Works with Atlas"
        action={<button type="button">Add</button>}
      />,
    );
    expect(screen.getByTestId('tile')).toBeTruthy();
    expect(screen.getByText('Health')).toBeTruthy();
    expect(screen.getByText('Sleep')).toBeTruthy();
    expect(screen.getByTestId('badge')).toBeTruthy();
    expect(screen.getByText('Works with Atlas').className).toBe('sk-rel');
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
  });
  it('is not a button without onOpen, and omits empty meta', () => {
    const { container } = render(<SkRow name="Solo" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('.sk-row-meta')).toBeNull();
  });
  it('opens on click, Enter and Space', () => {
    const on = vi.fn();
    render(<SkRow name="Open me" onOpen={on} />);
    const b = screen.getByRole('button', { name: /Open me/ });
    expect(b.getAttribute('tabindex')).toBe('0');
    fireEvent.click(b);
    fireEvent.keyDown(b, { key: 'Enter' });
    fireEvent.keyDown(b, { key: ' ' });
    fireEvent.keyDown(b, { key: 'a' });
    expect(on).toHaveBeenCalledTimes(3);
  });
  it('noBorder adds sk-nb', () => {
    const { container } = render(<SkRow name="x" noBorder />);
    expect(container.firstElementChild?.className).toContain('sk-nb');
  });
});
