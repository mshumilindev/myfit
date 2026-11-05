// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkToast } from './SkToast';

afterEach(cleanup);

describe('SkToast', () => {
  it('is a polite status by default with an info tone', () => {
    render(<SkToast>Saved</SkToast>);
    const t = screen.getByRole('status');
    expect(t.className).toContain('sk-toast-info');
    expect(t.textContent).toContain('Saved');
  });
  it('uses role=alert for the bad tone only', () => {
    const { rerender } = render(<SkToast tone="warn">x</SkToast>);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<SkToast tone="bad">x</SkToast>);
    expect(screen.getByRole('alert').className).toContain('sk-toast-bad');
  });
  it('renders an action and a labelled dismiss button', () => {
    const on = vi.fn();
    render(
      <SkToast tone="ok" action={<button>Undo</button>} onDismiss={on} dismissLabel="Close">
        Removed
      </SkToast>,
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(on).toHaveBeenCalledTimes(1);
  });
  it('has no dismiss button without onDismiss, and can be contained', () => {
    render(<SkToast contained>x</SkToast>);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('status').className).toContain('sk-toast-in');
  });
});
