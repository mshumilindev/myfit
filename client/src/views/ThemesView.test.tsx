import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemesView } from './ThemesView';

beforeEach(() => {
  setLocale('en');
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(cleanup);

describe('ThemesView', () => {
  it('draws each theme as its name set as a wordmark, with no screenshot and no user data', () => {
    const { container } = render(<ThemesView onClose={() => undefined} />);
    expect(container.querySelector('.thm-wm')?.textContent).toBe('Brass Glass');
    expect(container.querySelector('img, .thm-pv, .thm-pv-in')).toBeNull();
  });

  it('puts the theme in use first, as a disabled Applied button, without a Current tag', () => {
    const { container } = render(<ThemesView onClose={() => undefined} />);
    expect(container.querySelector('.thm-cell')?.classList.contains('thm-hero')).toBe(true);
    expect(screen.getByText(en.themesApplied).closest('button')?.hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.queryByText('Current')).toBeNull();
  });

  it('holds places for the themes still to come', () => {
    render(<ThemesView onClose={() => undefined} />);
    expect(screen.getAllByText(en.themesSoon)).toHaveLength(3);
  });
});
