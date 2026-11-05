// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
afterEach(cleanup);
import { SkTile } from './SkTile';

describe('SkTile', () => {
  it('shows one letter, hidden from AT, with tone class', () => {
    render(<SkTile letter="Hello" tone={3} />);
    const t = screen.getByText('H');
    expect(t.getAttribute('aria-hidden')).toBe('true');
    expect(t.className).toContain('sk-i3');
    expect(t.className).not.toMatch(/sk-ic\d/);
  });
  it.each([32, 40, 64, 96] as const)('size %i class', (s) => {
    render(<SkTile letter="A" tone={0} size={s} />);
    expect(screen.getByText('A').className).toContain(`sk-ic${s}`);
  });
  it('clamps tone to 0..9', () => {
    render(<SkTile letter="Z" tone={42} />);
    expect(screen.getByText('Z').className).toContain('sk-i9');
  });
  it('shows an icon child instead of the letter', () => {
    const { container } = render(
      <SkTile letter="" tone={5} size={64}>
        <svg data-testid="ic" />
      </SkTile>,
    );
    expect(container.querySelector('[data-testid="ic"]')).not.toBeNull();
    expect(container.textContent).toBe('');
  });
});
