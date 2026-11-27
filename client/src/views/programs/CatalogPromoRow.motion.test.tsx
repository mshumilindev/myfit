import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { addonsPref } from '../../addons/enabledSet';

const tier = vi.hoisted(() => ({ value: 'full' as 'full' | 'static' }));
vi.mock('../../motion', async (orig) => ({
  ...(await orig<typeof import('../../motion')>()),
  useMotionTier: () => tier.value,
}));

import { CatalogPromoRow } from './CatalogPromoRow';

describe('CatalogPromoRow icon motion', () => {
  beforeEach(() => {
    localStorage.setItem('spotter.role', 'member');
    addonsPref.reset();
  });
  afterEach(cleanup);

  it('plays the animated icon on the banner when motion is full', () => {
    tier.value = 'full';
    const { container } = render(<CatalogPromoRow />);
    expect(container.querySelector('img')?.getAttribute('src')).toContain('train-like-a-pro-anim');
  });
  it('shows the still icon when motion is reduced', () => {
    tier.value = 'static';
    const { container } = render(<CatalogPromoRow />);
    const src = container.querySelector('img')?.getAttribute('src') ?? '';
    expect(src).toContain('train-like-a-pro');
    expect(src).not.toContain('-anim');
  });
});
