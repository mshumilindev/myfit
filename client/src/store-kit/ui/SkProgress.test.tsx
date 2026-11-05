// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
afterEach(cleanup);
import { SkProgress } from './SkProgress';

describe('SkProgress', () => {
  it('exposes progressbar semantics and the css variable', () => {
    render(<SkProgress value={42} label="Installing" />);
    const p = screen.getByRole('progressbar', { name: 'Installing' });
    expect(p.getAttribute('aria-valuenow')).toBe('42');
    expect(p.style.getPropertyValue('--sk-pg-value')).toBe('42%');
  });
  it('clamps out-of-range and NaN values', () => {
    const { rerender } = render(<SkProgress value={150} label="p" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    rerender(<SkProgress value={-5} label="p" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    rerender(<SkProgress value={Number.NaN} label="p" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });
});
