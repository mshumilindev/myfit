import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BackButton } from './BackButton';

afterEach(cleanup);

describe('BackButton', () => {
  it('is a labelled non-submitting button with the small round well by default', () => {
    render(<BackButton label="Back" />);
    const b = screen.getByRole('button', { name: 'Back' });
    expect(b.getAttribute('type')).toBe('button');
    expect(b.className).toContain('uiback--sm');
    expect(b.className).not.toContain('uiback--text');
    expect(b.className).not.toContain('uiback--overlay');
    expect(b.querySelector('.uiback-t')).toBeNull();
  });

  it('text turns it into a pill but the accessible name stays the label', () => {
    render(<BackButton label="Back" text="Overview" />);
    const b = screen.getByRole('button', { name: 'Back' });
    expect(b.className).toContain('uiback--text');
    expect(b.querySelector('.uiback-t')?.textContent).toBe('Overview');
  });

  it.each(['sm', 'md', 'lg'] as const)('size %s maps to a class', (size) => {
    render(<BackButton label="Back" size={size} />);
    expect(screen.getByRole('button').className).toContain(`uiback--${size}`);
  });

  it('overlay and extra className are added to the kit classes', () => {
    render(<BackButton label="Back" overlay className="mine" />);
    const b = screen.getByRole('button');
    expect(b.className).toContain('uiback--overlay');
    expect(b.className).toContain('mine');
    expect(b.className).toContain('uiback');
  });

  it('fires onClick and respects disabled; type can be overridden', () => {
    const onClick = vi.fn();
    const { rerender } = render(<BackButton label="Back" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<BackButton label="Back" onClick={onClick} disabled type="submit" />);
    const b = screen.getByRole('button') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('type')).toBe('submit');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
