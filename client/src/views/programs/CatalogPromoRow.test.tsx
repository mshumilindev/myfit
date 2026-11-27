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

  it('shows the store-kit banner; Add and the title open the add-on page in the store', () => {
    const { container } = render(<CatalogPromoRow />);
    expect(container.querySelector('.sk-root .sk-btile')).not.toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toContain('train-like-a-pro');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(currentHash()).toBe('#/store/item/train-like-a-pro');
    window.history.replaceState(null, '', '/programs');
    fireEvent.click(screen.getByRole('button', { name: /Train like a pro/ }));
    expect(currentHash()).toBe('#/store/item/train-like-a-pro');
  });
  it('has no close button (it stays until the add-on is installed)', () => {
    render(<CatalogPromoRow />);
    expect(screen.queryByRole('button', { name: /close|dismiss/i })).toBeNull();
  });
  it('shows nothing once installed', () => {
    addonsPref.set(['train-like-a-pro']);
    const { container } = render(<CatalogPromoRow />);
    expect(container.textContent).toBe('');
  });
  it('shows the banner to a trainer or an admin too (they have Gym), but nothing to a manager', () => {
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
