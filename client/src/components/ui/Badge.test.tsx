import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Badge, badgeText } from './Badge';

afterEach(cleanup);

describe('badgeText', () => {
  it.each([
    [0, ''],
    [-3, ''],
    [Number.NaN, ''],
    [Number.POSITIVE_INFINITY, ''],
    [0.4, ''],
    [1, '1'],
    [7, '7'],
    [9, '9'],
    [10, '9+'],
    [23, '9+'],
    [148, '9+'],
    [9.9, '9'],
  ])('badgeText(%s) = %j', (n, text) => {
    expect(badgeText(n)).toBe(text);
  });

  it('honours a custom max', () => {
    expect(badgeText(99, 99)).toBe('99');
    expect(badgeText(100, 99)).toBe('99+');
  });
});

describe('Badge', () => {
  it('renders nothing for a zero count', () => {
    const { container } = render(<Badge n={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows 9+ above nine and hides the glyph from assistive tech', () => {
    const { container } = render(<Badge n={148} anchor="corner" label="unread" />);
    const pill = container.querySelector('.uibadge') as HTMLElement;
    expect(pill.className).toContain('uibadge--corner');
    const glyph = pill.querySelector('[aria-hidden]') as HTMLElement;
    expect(glyph.textContent).toBe('9+');
    expect(screen.getByText('unread').className).toContain('visually-hidden');
  });

  it('maps size and tone to classes', () => {
    const { container } = render(<Badge n={3} size="md" tone="accent" />);
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).toContain('uibadge--md');
    expect(cls).toContain('uibadge--accent');
  });
});
