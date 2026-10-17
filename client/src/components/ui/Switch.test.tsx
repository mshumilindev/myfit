import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Switch, SwitchIndicator } from './Switch';

afterEach(cleanup);

describe('Switch', () => {
  it('is a checkbox with role switch reflecting checked', () => {
    const { rerender } = render(<Switch checked={false} onChange={() => {}} aria-label="Sound" />);
    const sw = screen.getByRole('switch', { name: 'Sound' }) as HTMLInputElement;
    expect(sw.type).toBe('checkbox');
    expect(sw.checked).toBe(false);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    rerender(<Switch checked onChange={() => {}} aria-label="Sound" />);
    expect(sw.checked).toBe(true);
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('calls onChange with the next boolean on click', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Switch checked={false} onChange={onChange} aria-label="s" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenLastCalledWith(true);
    rerender(<Switch checked onChange={onChange} aria-label="s" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('is natively disabled when disabled', () => {
    render(<Switch checked={false} disabled onChange={() => {}} aria-label="s" />);
    expect((screen.getByRole('switch') as HTMLInputElement).disabled).toBe(true);
  });

  it('maps size and tone to classes; inherit adds no tone class', () => {
    const { container, rerender } = render(
      <Switch checked onChange={() => {}} size="sm" tone="ok" aria-label="s" className="x" />,
    );
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).toContain('uisw--sm');
    expect(cls).toContain('uit--ok');
    expect(cls).toContain('x');
    rerender(<Switch checked onChange={() => {}} tone="inherit" aria-label="s" />);
    const cls2 = (container.firstChild as HTMLElement).className;
    expect(cls2).toContain('uisw--md');
    expect(cls2).not.toContain('uit--');
  });

  it('defaults to the accent tone', () => {
    const { container } = render(<Switch checked onChange={() => {}} aria-label="s" />);
    expect((container.firstChild as HTMLElement).className).toContain('uit--accent');
  });

  it('the label wrapper toggles it', () => {
    const onChange = vi.fn();
    render(
      <label>
        Notify
        <Switch checked={false} onChange={onChange} />
      </label>,
    );
    fireEvent.click(screen.getByText('Notify'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('SwitchIndicator', () => {
  it('exposes role switch with aria-checked and an is-on class', () => {
    const { rerender } = render(<SwitchIndicator on />);
    const el = screen.getByRole('switch');
    expect(el.getAttribute('aria-checked')).toBe('true');
    expect(el.className).toContain('is-on');
    expect(el.className).toContain('uisw--ind');
    rerender(<SwitchIndicator on={false} size="sm" tone="inherit" />);
    const off = screen.getByRole('switch');
    expect(off.getAttribute('aria-checked')).toBe('false');
    expect(off.className).not.toContain('is-on');
    expect(off.className).toContain('uisw--sm');
    expect(off.className).not.toContain('uit--');
  });
});
