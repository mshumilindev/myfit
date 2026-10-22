import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMobileSheetKeyboardMode } from './useSheetKeyboard';

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const expanded = useMobileSheetKeyboardMode(ref);
  return (
    <div ref={ref} data-expanded={String(expanded)}>
      <input aria-label="field" />
    </div>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useMobileSheetKeyboardMode cleanup', () => {
  it('leaves no pending timer after unmount (focusout settle and pointer-end deferrals)', () => {
    const { unmount } = render(<Probe />);
    act(() => {
      window.dispatchEvent(new Event('focusout'));
      window.dispatchEvent(new Event('pointerdown'));
      window.dispatchEvent(new Event('pointerup'));
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('still settles the expanded state while mounted', () => {
    const { container } = render(<Probe />);
    fireEvent.focusOut(container.querySelector('input')!);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(container.firstElementChild?.getAttribute('data-expanded')).toBe('false');
  });
});
