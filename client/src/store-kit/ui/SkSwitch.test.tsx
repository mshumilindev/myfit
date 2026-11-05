// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(cleanup);
import { SkSwitch } from './SkSwitch';

describe('SkSwitch', () => {
  it('is a switch reflecting on', () => {
    const { rerender } = render(<SkSwitch on={false} label="Sync" />);
    const s = screen.getByRole('switch', { name: 'Sync' });
    expect(s.getAttribute('aria-checked')).toBe('false');
    rerender(<SkSwitch on label="Sync" />);
    expect(s.getAttribute('aria-checked')).toBe('true');
    expect(s.querySelector('.sk-sw')!.className).toContain('sk-on');
  });
  it('calls onChange with the toggled value', () => {
    const on = vi.fn();
    render(<SkSwitch on label="Sync" onChange={on} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(on).toHaveBeenCalledWith(false);
  });
  it('does nothing when disabled', () => {
    const on = vi.fn();
    render(<SkSwitch on={false} label="Sync" onChange={on} disabled />);
    fireEvent.click(screen.getByRole('switch'));
    expect(on).not.toHaveBeenCalled();
  });
});
