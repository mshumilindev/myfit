import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEMES, initTheme, type ThemeDef } from '../themes';
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

describe('ThemesView during a holiday theme (SPO-321)', () => {
  const list = THEMES as ThemeDef[];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 28, 12));
    list.push({ id: 'halloween', name: 'Halloween', since: '2026-10-28', holiday: 'halloween' });
    document.documentElement.lang = 'en';
    initTheme();
  });
  afterEach(() => {
    list.splice(
      list.findIndex((t) => t.id === 'halloween'),
      1,
    );
    vi.useRealTimers();
  });

  it('does not offer the holiday theme and marks no card as in use: the saved theme is veiled', () => {
    const { container } = render(<ThemesView onClose={() => undefined} />);
    expect(screen.queryByText('Halloween')).toBeNull();
    expect(screen.queryByText(en.themesApplied)).toBeNull();
    // every offered theme is a framed card in its own document
    expect(container.querySelectorAll('iframe.thm-frame')).toHaveLength(2);
    expect(screen.queryAllByText(en.themesApply)).toHaveLength(0); // buttons live inside the frames
  });
});
