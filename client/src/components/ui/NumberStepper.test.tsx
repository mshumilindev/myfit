import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NumberStepper, type NumberStepperProps } from './NumberStepper';

afterEach(cleanup);

function setup(p: Partial<NumberStepperProps> = {}) {
  const onChange = vi.fn();
  const utils = render(<NumberStepper label="Weight" value={10} onChange={onChange} {...p} />);
  const input = screen
    .getAllByLabelText('Weight')
    .find((e) => e.tagName === 'INPUT') as HTMLInputElement;
  return { onChange, input, ...utils };
}

describe('NumberStepper', () => {
  it('is a labelled group with the value and unit', () => {
    const { input } = setup({ unit: 'kg' });
    expect(screen.getByRole('group', { name: 'Weight' })).toBeTruthy();
    expect(input.value).toBe('10');
    expect(screen.getByText('kg')).toBeTruthy();
  });

  it('+ and − move by step and report the clamped result', () => {
    const { onChange } = setup({ step: 2.5, decimals: 1 });
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(onChange).toHaveBeenLastCalledWith(12.5);
    fireEvent.click(screen.getByRole('button', { name: '−' }));
    expect(onChange).toHaveBeenLastCalledWith(7.5);
  });

  it('clamps to min and max', () => {
    const a = setup({ value: 0, min: 0 });
    fireEvent.click(screen.getByRole('button', { name: '−' }));
    expect(a.onChange).toHaveBeenLastCalledWith(0);
    a.unmount();
    const b = setup({ value: 9, max: 10, step: 5 });
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(b.onChange).toHaveBeenLastCalledWith(10);
  });

  it('formats decimals without trailing zeros and picks the keypad mode', () => {
    const a = setup({ value: 2.5, decimals: 2 });
    expect(a.input.value).toBe('2.5');
    expect(a.input.getAttribute('inputmode')).toBe('decimal');
    a.unmount();
    const b = setup({ value: 10 });
    expect(b.input.getAttribute('inputmode')).toBe('numeric');
  });

  it('typing keeps a draft and commits on blur (comma accepted, rounded)', () => {
    const { input, onChange } = setup({ decimals: 1 });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12,34' } });
    expect(input.value).toBe('12,34');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(12.3);
  });

  it('Enter commits; empty or non-numeric drafts keep the old value', () => {
    const { input, onChange } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '15' } });
    input.focus();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(15);
    onChange.mockClear();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('size and focused map to classes; clicking calls onFocus', () => {
    const onFocus = vi.fn();
    setup({ size: 'xl', focused: true, onFocus, className: 'x' });
    const group = screen.getByRole('group');
    expect(group.className).toContain('uistep--xl');
    expect(group.className).toContain('is-focused');
    expect(group.className).toContain('x');
    fireEvent.click(group);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('disabled disables controls and ignores onFocus clicks', () => {
    const onFocus = vi.fn();
    setup({ disabled: true, onFocus });
    const group = screen.getByRole('group');
    expect(group.className).toContain('is-disabled');
    expect((screen.getByRole('button', { name: '+' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(group);
    expect(onFocus).not.toHaveBeenCalled();
  });

  it('disabled with a placeholder shows it instead of the controls', () => {
    setup({ disabled: true, placeholder: 'BW' });
    expect(screen.getByText('BW')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
