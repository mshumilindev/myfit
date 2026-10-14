import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UndoSnackbar } from './Overlays';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('UndoSnackbar (one kit UndoToast)', () => {
  it('renders the kit UndoToast with the countdown bar and closes after the single 8 s window', () => {
    const onDone = vi.fn();
    render(<UndoSnackbar snack={{ text: 'Set deleted', onUndo: vi.fn() }} onDone={onDone} />);
    expect(screen.getByText('Set deleted')).toBeTruthy();
    expect(screen.getByTestId('undo-bar')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(7900));
    expect(onDone).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(200));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
  it('a re-render with a new onDone does not restart the window', () => {
    const a = vi.fn();
    const b = vi.fn();
    const snack = { text: 'x', onUndo: vi.fn() };
    const { rerender } = render(<UndoSnackbar snack={snack} onDone={a} />);
    act(() => void vi.advanceTimersByTime(6000));
    rerender(<UndoSnackbar snack={snack} onDone={b} />);
    act(() => void vi.advanceTimersByTime(2100));
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
  it('Undo runs the undo and closes', () => {
    const onUndo = vi.fn();
    const onDone = vi.fn();
    render(<UndoSnackbar snack={{ text: 'x', onUndo }} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });
});
