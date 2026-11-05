// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkHero } from './SkHero';

afterEach(cleanup);

describe('SkHero', () => {
  it('shows the figure and an accessible progress bar', () => {
    render(<SkHero eyebrow="Your Spotter" done={7} total={9} title="2 left" />);
    const bar = screen.getByRole('progressbar', { name: 'Your Spotter' });
    expect(bar.getAttribute('aria-valuenow')).toBe('78');
    expect(screen.getByText('2 left')).toBeTruthy();
    expect(screen.getByText(/\/ 9/)).toBeTruthy();
  });
  it('sets the width custom property and clamps', () => {
    const { rerender } = render(<SkHero eyebrow="e" done={9} total={10} title="t" />);
    expect(
      (screen.getByRole('progressbar').firstElementChild as HTMLElement).style.getPropertyValue(
        '--sk-hero-pct',
      ),
    ).toBe('90%');
    rerender(<SkHero eyebrow="e" done={0} total={0} percent={150} title="t" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });
  it('maps state and renders badge and body', () => {
    const { container } = render(
      <SkHero
        state="complete"
        eyebrow="e"
        done={9}
        total={9}
        badge={<b>Complete</b>}
        title="t"
        body="b"
      />,
    );
    expect(container.firstElementChild?.className).toContain('sk-hero-complete');
    expect(container.firstElementChild?.getAttribute('data-state')).toBe('complete');
    expect(screen.getByText('Complete')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
  });
});
