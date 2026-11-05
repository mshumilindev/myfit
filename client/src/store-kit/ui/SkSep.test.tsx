// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkSep } from './SkSep';

afterEach(cleanup);

describe('SkSep', () => {
  it('is a horizontal separator by default', () => {
    render(<SkSep />);
    const s = screen.getByRole('separator');
    expect(s.getAttribute('aria-orientation')).toBe('horizontal');
    expect(s.className).toBe('sk-sep');
  });
  it('supports vertical', () => {
    render(<SkSep vertical />);
    const s = screen.getByRole('separator');
    expect(s.getAttribute('aria-orientation')).toBe('vertical');
    expect(s.className).toContain('sk-sep-v');
  });
});
