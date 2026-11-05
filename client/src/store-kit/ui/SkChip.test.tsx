// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(cleanup);
import { SkChip } from './SkChip';

describe('SkChip', () => {
  it('is a toggle button reflecting on', () => {
    const { rerender } = render(<SkChip>Health</SkChip>);
    const b = screen.getByRole('button', { name: 'Health' });
    expect(b.getAttribute('aria-pressed')).toBe('false');
    rerender(<SkChip on>Health</SkChip>);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.className).toContain('sk-on');
  });
  it('fires onClick, not when disabled', () => {
    const on = vi.fn();
    const { rerender } = render(<SkChip onClick={on}>A</SkChip>);
    fireEvent.click(screen.getByRole('button'));
    expect(on).toHaveBeenCalledTimes(1);
    rerender(
      <SkChip onClick={on} disabled>
        A
      </SkChip>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(on).toHaveBeenCalledTimes(1);
  });
});
