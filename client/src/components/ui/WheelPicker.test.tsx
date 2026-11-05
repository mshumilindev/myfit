import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WheelColumn } from './WheelColumn';
import { WheelPicker, type WheelPickerProps } from './WheelPicker';

afterEach(cleanup);

function setup(p: Partial<WheelPickerProps> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <WheelPicker
      label="Weight"
      value={60}
      onChange={onChange}
      step={0.5}
      max={300}
      decimals={1}
      {...p}
    />,
  );
  return { onChange, ...utils };
}
const drum = () => screen.getByRole('spinbutton', { name: 'Weight' });

describe('WheelPicker', () => {
  it('is a labelled group whose drum is a spin button with the spoken value', () => {
    setup({ unit: 'kg' });
    expect(screen.getByRole('group', { name: 'Weight' })).toBeTruthy();
    expect(drum().getAttribute('aria-valuetext')).toBe('60 kg');
  });

  it('marks the held value as selected and shows the unit only next to it', () => {
    const { container } = setup({ unit: 'kg' });
    const sel = container.querySelectorAll('.uiwheel-i.is-sel');
    expect(sel).toHaveLength(1);
    expect(sel[0].textContent).toBe('60kg');
    expect(container.querySelectorAll('.uiwheel-u')).toHaveLength(1);
  });

  it('arrow keys move one step, Page keys five, Home / End go to the ends', () => {
    const { onChange } = setup();
    fireEvent.keyDown(drum(), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(59.5);
    fireEvent.keyDown(drum(), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(60.5);
    fireEvent.keyDown(drum(), { key: 'PageDown' });
    expect(onChange).toHaveBeenLastCalledWith(62.5);
    fireEvent.keyDown(drum(), { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(drum(), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(300);
  });

  it('does not go past the first or last value', () => {
    const a = setup({ value: 0 });
    fireEvent.keyDown(drum(), { key: 'ArrowUp' });
    expect(a.onChange).toHaveBeenLastCalledWith(0);
    a.unmount();
    const b = setup({ value: 300 });
    fireEvent.keyDown(drum(), { key: 'ArrowDown' });
    expect(b.onChange).toHaveBeenLastCalledWith(300);
  });

  it('tapping a row picks it', () => {
    const { onChange, container } = setup();
    const rows = container.querySelectorAll('.uiwheel-i');
    const row = rows[Array.from(rows).findIndex((r) => r.classList.contains('is-sel')) + 2];
    fireEvent.pointerDown(row, { clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(row, { clientY: 100, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(61);
  });

  it('keeps an off-grid value selectable instead of showing another number', () => {
    const { container } = setup({ value: 61.25 });
    expect(container.querySelector('.uiwheel-i.is-sel')?.textContent).toBe('61.25');
    expect(drum().getAttribute('aria-valuetext')).toBe('61.25');
  });

  it('typing commits on blur, clamps to the range and snaps to the grid', () => {
    const { onChange } = setup({ max: 100 });
    const edit = screen.getByLabelText('Weight (type)') as HTMLInputElement;
    fireEvent.focus(edit);
    fireEvent.change(edit, { target: { value: '82,3' } });
    fireEvent.blur(edit);
    expect(onChange).toHaveBeenLastCalledWith(82.5);
    fireEvent.focus(edit);
    fireEvent.change(edit, { target: { value: '9999' } });
    fireEvent.blur(edit);
    expect(onChange).toHaveBeenLastCalledWith(100);
  });

  it('entering the field and leaving it untouched keeps an off-grid value as it is', () => {
    const { onChange } = setup({ value: 61.25 });
    const edit = screen.getByLabelText('Weight (type)');
    fireEvent.focus(edit);
    fireEvent.blur(edit);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('an empty or non-numeric draft keeps the previous value', () => {
    const { onChange } = setup();
    const edit = screen.getByLabelText('Weight (type)');
    fireEvent.focus(edit);
    fireEvent.change(edit, { target: { value: '' } });
    fireEvent.blur(edit);
    fireEvent.focus(edit);
    fireEvent.change(edit, { target: { value: 'abc' } });
    fireEvent.blur(edit);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Enter commits the typed value', () => {
    const { onChange } = setup();
    const edit = screen.getByLabelText('Weight (type)');
    fireEvent.focus(edit);
    fireEvent.change(edit, { target: { value: '70' } });
    edit.focus();
    fireEvent.keyDown(edit, { key: 'Enter' });
    fireEvent.blur(edit);
    expect(onChange).toHaveBeenLastCalledWith(70);
  });

  it('the stepper variant adds − and + beside the drum', () => {
    const { onChange } = setup({ input: 'stepper' });
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(onChange).toHaveBeenLastCalledWith(60.5);
    fireEvent.click(screen.getByRole('button', { name: '−' }));
    expect(onChange).toHaveBeenLastCalledWith(59.5);
  });

  it('the wheel-only variant has no typing field', () => {
    setup({ input: 'wheel' });
    expect(screen.queryByLabelText('Weight (type)')).toBeNull();
  });

  it('the native variant is a plain select reporting the number', () => {
    const { onChange } = setup({ input: 'native', unit: 'kg' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Weight' }), {
      target: { value: '62.5' },
    });
    expect(onChange).toHaveBeenLastCalledWith(62.5);
    expect(screen.getByText('kg')).toBeTruthy();
  });

  it('disabled with a placeholder shows it instead of the drum', () => {
    setup({ disabled: true, placeholder: 'BW' });
    expect(screen.getByText('BW')).toBeTruthy();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('disabled without a placeholder ignores keys and taps', () => {
    const { onChange, container } = setup({ disabled: true });
    fireEvent.keyDown(drum(), { key: 'ArrowDown' });
    fireEvent.click(container.querySelectorAll('.uiwheel-i')[3]);
    expect(onChange).not.toHaveBeenCalled();
    expect(drum().getAttribute('aria-disabled')).toBe('true');
  });

  it('settling a scroll reports the row it landed on', () => {
    vi.useFakeTimers();
    try {
      const { onChange } = setup();
      const el = drum();
      Object.defineProperty(el.querySelector('.uiwheel-i'), 'offsetHeight', {
        value: 40,
        configurable: true,
      });
      Object.defineProperty(el.querySelector('.uiwheel-i') as HTMLElement, 'offsetHeight', {
        value: 40,
      });
      el.scrollTop = 40 * 125; // row 125 of the 0.5-step grid = 62.5
      fireEvent.scroll(el);
      vi.advanceTimersByTime(130);
      expect(onChange).toHaveBeenLastCalledWith(62.5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('split columns pick whole and fraction separately', () => {
    const { onChange } = setup({ columns: 'split', value: 82.5, max: 200 });
    const [whole, frac] = screen.getAllByRole('spinbutton');
    fireEvent.keyDown(whole, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(83.5);
    fireEvent.keyDown(frac, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(82);
  });
});

describe('WheelColumn drag (SPO-318)', () => {
  function setupCol(onIndex = vi.fn(), onTapSelected = vi.fn(), onDetent = vi.fn()) {
    const items = Array.from({ length: 30 }, (_, i) => ({ key: String(i), label: String(i) }));
    render(
      <WheelColumn
        label="Reps"
        items={items}
        index={5}
        onIndex={onIndex}
        onTapSelected={onTapSelected}
        onDetent={onDetent}
      />,
    );
    const col = screen.getByRole('spinbutton', { name: 'Reps' });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 40 });
    return { col, onIndex, onTapSelected, onDetent };
  }
  const ptr = (type: string, y: number, target: Element) =>
    fireEvent(
      target,
      new MouseEvent(type, { bubbles: true, clientY: y, button: 0 }) as unknown as Event,
    );

  it('a tiny movement is a tap, not a drag', () => {
    const { col, onIndex, onTapSelected } = setupCol();
    const sel = col.querySelector('.is-sel')!;
    ptr('pointerdown', 100, sel);
    ptr('pointermove', 103, sel);
    ptr('pointerup', 103, sel);
    fireEvent.click(sel);
    expect(onTapSelected).toHaveBeenCalledTimes(1);
    expect(onIndex).not.toHaveBeenCalled();
  });

  it('a tap on another row jumps to it', () => {
    const { col, onIndex } = setupCol();
    const row = col.querySelectorAll('.uiwheel-i')[8];
    ptr('pointerdown', 100, row);
    ptr('pointerup', 100, row);
    expect(onIndex).toHaveBeenCalledWith(8);
  });

  it('a drag past the slop moves the drum and is not a tap', () => {
    const { col, onTapSelected } = setupCol();
    const sel = col.querySelector('.is-sel')!;
    ptr('pointerdown', 200, sel);
    ptr('pointermove', 150, sel);
    expect(col.classList.contains('is-flinging')).toBe(true);
    expect(col.scrollTop).toBeGreaterThan(0);
    ptr('pointerup', 150, sel);
    expect(onTapSelected).not.toHaveBeenCalled();
  });
});
