import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Gallery } from './Gallery';

afterEach(cleanup);

// Gallery is a dev-only token gallery (#/uikit): smoke render + the close path only.
describe('Gallery (smoke)', () => {
  it('renders the screen shell and title', () => {
    const { container } = render(<Gallery onClose={() => undefined} />);
    expect(container.querySelector('.uik')).not.toBeNull();
    expect(screen.getByText('UI Kit')).toBeTruthy();
  });

  it('back button calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<Gallery onClose={onClose} />);
    const back = container.querySelector('.uik-top button') as HTMLElement;
    fireEvent.click(back);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders every token and primitive group with content', () => {
    const { container } = render(<Gallery onClose={() => undefined} />);
    const groups = container.querySelectorAll('section.uik-group');
    expect(groups.length).toBeGreaterThanOrEqual(15);
    for (const g of groups) {
      expect(g.querySelector('h2, h3, .uik-group-title')?.textContent?.trim()).toBeTruthy();
      expect(g.children.length).toBeGreaterThan(1);
    }
  });

  it('selectable chips toggle: picking selects, picking again clears', () => {
    render(<Gallery onClose={() => undefined} />);
    const pressed = (n: string) =>
      screen.getByRole('button', { name: n }).getAttribute('aria-pressed');
    expect(pressed('Chest')).toBe('true'); // initial pick
    fireEvent.click(screen.getByRole('button', { name: 'Legs' }));
    expect(pressed('Legs')).toBe('true');
    expect(pressed('Chest')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Legs' }));
    expect(pressed('Legs')).toBe('false');
  });
});
