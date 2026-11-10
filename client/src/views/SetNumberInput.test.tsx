import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { storeInputMode } from '../inputModeStore';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { SetNumberInput } from './SetNumberInput';

const drum = () => screen.getByRole('spinbutton', { name: en.weightCol });

function weight(value: number, unit: 'kg' | 'lb' = 'kg') {
  const onChange = vi.fn();
  render(
    <SetNumberInput
      field="weight"
      label="Weight, kg"
      value={value}
      unit={unit}
      onChange={onChange}
    />,
  );
  return onChange;
}

beforeEach(() => {
  setLocale('en');
  act(() => storeInputMode('wheel'));
});
afterEach(() => {
  cleanup();
  act(() => storeInputMode('stepper'));
});

describe('SetNumberInput: the weight wheel step (SPO-484 / SPO-488)', () => {
  it('moves a kg weight in 2.5 steps, up and down', () => {
    const onChange = weight(60);
    fireEvent.keyDown(drum(), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(62.5);
    fireEvent.keyDown(drum(), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(57.5);
  });

  it('moves lb in 5s, like the − / + stepper', () => {
    const onChange = weight(135, 'lb');
    fireEvent.keyDown(drum(), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(140);
  });

  it('shows an off-grid logged weight as it is (17.25 is not rounded); the drum then goes to the next mark', () => {
    const onChange = weight(17.25);
    expect(drum().getAttribute('aria-valuetext')).toBe('17.25 kg');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(drum(), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(17.5);
  });

  it('keeps typing free: 1.25 and 0.5 are saved exactly', () => {
    const onChange = weight(60);
    for (const v of ['1.25', '0.5']) {
      fireEvent.click(drum());
      const input = document.querySelector('input') as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: v } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenLastCalledWith(Number(v));
    }
  });

  it('the − / + mode keeps its own step (2.5 kg, 5 lb) and saves the picked value', () => {
    act(() => storeInputMode('stepper'));
    const onChange = weight(60);
    fireEvent.click(screen.getByRole('button', { name: /increase|\+/i }));
    expect(onChange).toHaveBeenLastCalledWith(62.5);
  });
});
