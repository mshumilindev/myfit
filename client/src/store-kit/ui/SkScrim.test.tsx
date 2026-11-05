// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkScrim } from './SkScrim';

afterEach(cleanup);

describe('SkScrim', () => {
  it('is decorative and fixed by default', () => {
    render(<SkScrim />);
    const s = screen.getByTestId('sk-scrim');
    expect(s.getAttribute('aria-hidden')).toBe('true');
    expect(s.className).not.toContain('sk-scrim-in');
  });
  it('can be contained in a frame', () => {
    render(<SkScrim contained />);
    expect(screen.getByTestId('sk-scrim').className).toContain('sk-scrim-in');
  });
  it('dismisses on click', () => {
    const on = vi.fn();
    render(<SkScrim onDismiss={on} />);
    fireEvent.click(screen.getByTestId('sk-scrim'));
    expect(on).toHaveBeenCalledTimes(1);
  });
});
