import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { addonsPref } from '../../addons/enabledSet';
import { currentHash } from '../../route';
import { CatalogPromoRow } from './CatalogPromoRow';

describe('CatalogPromoRow (Programs, add-on not installed)', () => {
  beforeEach(() => {
    localStorage.setItem('spotter.role', 'member');
    addonsPref.reset();
    window.history.replaceState(null, '', '/programs');
  });
  afterEach(cleanup);

  it('shows a quiet row that opens the add-on page in the store', () => {
    render(<CatalogPromoRow />);
    fireEvent.click(screen.getByRole('button', { name: /Train like a pro/ }));
    expect(currentHash()).toBe('#/store/item/train-like-a-pro');
  });
  it('shows nothing once installed', () => {
    addonsPref.set(['train-like-a-pro']);
    const { container } = render(<CatalogPromoRow />);
    expect(container.textContent).toBe('');
  });
  it('shows the quiet row to a trainer or an admin too (they have Gym), but nothing to a manager', () => {
    for (const role of ['trainer', 'admin']) {
      localStorage.setItem('spotter.role', role);
      const { container } = render(<CatalogPromoRow />);
      expect(container.textContent, role).toContain('Train like a pro');
      cleanup();
    }
    localStorage.setItem('spotter.role', 'manager');
    const { container } = render(<CatalogPromoRow />);
    expect(container.textContent).toBe('');
    cleanup();
    localStorage.setItem('spotter.role', 'member');
  });
});
