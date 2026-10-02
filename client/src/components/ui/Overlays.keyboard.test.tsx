import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Sheet } from './Overlays';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const sheet = () => document.querySelector('.sheet') as HTMLElement;

describe('Sheet keyboard mode', () => {
  it('keeps the layout still while a tap is in progress, so the tap on Save is not lost', () => {
    vi.useFakeTimers();
    render(
      <Sheet onClose={() => undefined}>
        <input aria-label="field" />
        <button type="button">Save</button>
      </Sheet>,
    );
    const input = document.querySelector('input') as HTMLInputElement;
    const saveBtn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Save',
    ) as HTMLElement;
    expect(saveBtn).toBeTruthy();

    act(() => input.focus());
    expect(sheet().className).toContain('sheet-keyboard-expanded');

    // Finger down on Save: the field blurs, focus moves to the button.
    fireEvent.pointerDown(saveBtn);
    act(() => saveBtn.focus());
    act(() => void vi.advanceTimersByTime(500));
    expect(sheet().className).toContain('sheet-keyboard-expanded');

    // Finger up: now the sheet may settle back.
    fireEvent.pointerUp(saveBtn);
    act(() => void vi.advanceTimersByTime(50));
    expect(sheet().className).not.toContain('sheet-keyboard-expanded');
  });

  it('collapses as before when no pointer is down', () => {
    vi.useFakeTimers();
    render(
      <Sheet onClose={() => undefined}>
        <input aria-label="field" />
        <button type="button">Save</button>
      </Sheet>,
    );
    const input = document.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    expect(sheet().className).toContain('sheet-keyboard-expanded');
    act(() => input.blur());
    act(() => void vi.advanceTimersByTime(300));
    expect(sheet().className).not.toContain('sheet-keyboard-expanded');
  });
});
