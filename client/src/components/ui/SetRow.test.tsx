import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SetRow } from './SetRow';

afterEach(cleanup);

describe('SetRow', () => {
  it('is a button of type button with the base classes', () => {
    render(<SetRow>row</SetRow>);
    const el = screen.getByRole('button', { name: 'row' });
    expect(el.getAttribute('type')).toBe('button');
    expect(el.className).toBe('uisetrow set-row');
  });

  it.each([
    ['warm', 'warm'],
    ['record', 'record'],
    ['timed', 'timed'],
    ['metered', 'metered'],
    ['compact', 'compact'],
  ] as const)('%s adds the %s class', (prop, cls) => {
    render(<SetRow {...{ [prop]: true }}>r</SetRow>);
    expect(screen.getByRole('button').classList.contains(cls)).toBe(true);
  });

  it('combines several variants and a custom className', () => {
    render(
      <SetRow warm timed className="mine">
        r
      </SetRow>,
    );
    const el = screen.getByRole('button');
    for (const c of ['warm', 'timed', 'mine']) expect(el.classList.contains(c)).toBe(true);
    expect(el.classList.contains('record')).toBe(false);
  });

  it('fires onClick, and not when disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<SetRow onClick={onClick}>r</SetRow>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <SetRow onClick={onClick} disabled>
        r
      </SetRow>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('allows the type to be overridden and passes style through', () => {
    render(
      <SetRow type="submit" style={{ width: 10 }}>
        r
      </SetRow>,
    );
    const el = screen.getByRole('button');
    expect(el.getAttribute('type')).toBe('submit');
    expect(el.style.width).toBe('10px');
  });
});
