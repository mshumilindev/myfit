// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkBtn } from './SkBtn';

afterEach(cleanup);

describe('SkBtn', () => {
  it('is a real button with the tint kind by default', () => {
    render(<SkBtn>Add</SkBtn>);
    const b = screen.getByRole('button', { name: 'Add' });
    expect(b.getAttribute('type')).toBe('button');
    expect(b.className).toContain('sk-bt-tint');
  });
  it('maps kind and size to classes', () => {
    render(
      <SkBtn kind="inv" size="s">
        x
      </SkBtn>,
    );
    expect(screen.getByRole('button').className).toMatch(/sk-bt-inv.*sk-bt-s/);
  });
  it('fires onClick and respects disabled', () => {
    const on = vi.fn();
    const { rerender } = render(<SkBtn onClick={on}>Go</SkBtn>);
    fireEvent.click(screen.getByRole('button'));
    expect(on).toHaveBeenCalledTimes(1);
    rerender(
      <SkBtn onClick={on} disabled>
        Go
      </SkBtn>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(on).toHaveBeenCalledTimes(1);
  });
});
