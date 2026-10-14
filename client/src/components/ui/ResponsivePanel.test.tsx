import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResponsivePanel } from './ResponsivePanel';

afterEach(cleanup);

describe('ResponsivePanel (phone sheet)', () => {
  it('is a named modal dialog, moves focus in, closes on Escape and returns focus to the anchor', () => {
    const anchor = createRef<HTMLButtonElement>();
    const onClose = vi.fn();
    const ui = (open: boolean) => (
      <>
        <button ref={anchor}>Open</button>
        <ResponsivePanel open={open} onClose={onClose} anchorRef={anchor} label="Filters">
          <button>Inside</button>
        </ResponsivePanel>
      </>
    );
    vi.useFakeTimers();
    const { rerender } = render(ui(true));
    const dlg = screen.getByRole('dialog', { name: 'Filters' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dlg);
    fireEvent.keyDown(document, { key: 'Escape' });
    act(() => void vi.advanceTimersByTime(300));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(ui(false));
    expect(document.activeElement).toBe(anchor.current);
    vi.useRealTimers();
  });
});
