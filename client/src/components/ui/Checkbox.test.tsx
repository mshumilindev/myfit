import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Checkbox } from './Checkbox';

afterEach(cleanup);

describe('Checkbox', () => {
  it('is a real checkbox reflecting checked, with a hidden drawn box', () => {
    const { container, rerender } = render(
      <Checkbox checked={false} onChange={vi.fn()} aria-label="Agree" />,
    );
    const input = screen.getByRole('checkbox', { name: 'Agree' }) as HTMLInputElement;
    expect(input.checked).toBe(false);
    expect(container.querySelector('.uicheck-box')?.getAttribute('aria-hidden')).toBe('true');
    rerender(<Checkbox checked onChange={vi.fn()} aria-label="Agree" />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('onChange receives the new boolean', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Checkbox checked={false} onChange={onChange} aria-label="A" />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith(true);
    rerender(<Checkbox checked onChange={onChange} aria-label="A" />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('passes disabled through to the native input', () => {
    render(<Checkbox checked={false} onChange={vi.fn()} disabled aria-label="A" />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('accent tone by default; tone and className map to classes', () => {
    const { container, rerender } = render(
      <Checkbox checked={false} onChange={vi.fn()} aria-label="A" />,
    );
    expect(container.querySelector('.uicheck')?.className).toContain('uit--accent');
    rerender(
      <Checkbox checked={false} onChange={vi.fn()} tone="danger" className="mine" aria-label="A" />,
    );
    const cls = container.querySelector('.uicheck')?.className ?? '';
    expect(cls).toContain('uit--danger');
    expect(cls).toContain('mine');
  });

  it('a wrapping label names it and toggles it', () => {
    const onChange = vi.fn();
    render(
      <label>
        <Checkbox checked={false} onChange={onChange} />
        <span>Also delete notes</span>
      </label>,
    );
    fireEvent.click(screen.getByLabelText('Also delete notes'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
