import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OptionTile } from './OptionTile';

afterEach(cleanup);

describe('OptionTile', () => {
  it('is a radio button that reports its state', () => {
    render(
      <div role="radiogroup" aria-label="Icon">
        <OptionTile selected aria-label="star">
          *
        </OptionTile>
        <OptionTile selected={false} aria-label="heart">
          +
        </OptionTile>
      </div>,
    );
    const on = screen.getByRole('radio', { name: 'star' });
    const off = screen.getByRole('radio', { name: 'heart' });
    expect(on.getAttribute('aria-checked')).toBe('true');
    expect(on.className).toContain('is-on');
    expect(off.getAttribute('aria-checked')).toBe('false');
    expect(off.className).not.toContain('is-on');
    expect(on.getAttribute('type')).toBe('button');
  });

  it('keeps the caller class and passes the press through', () => {
    const onClick = vi.fn();
    render(
      <OptionTile selected={false} className="mine" onClick={onClick} aria-label="x">
        x
      </OptionTile>,
    );
    const b = screen.getByRole('radio');
    expect(b.className).toBe('ui-opt mine');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
