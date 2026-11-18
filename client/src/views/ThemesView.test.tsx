import { setLocale } from '../i18n';
import { THEMES, setAllowedThemes } from '../themes/registry';
import { en } from '../i18n/en';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initTheme, setTheme } from '../themes';
import { addonsPref } from '../addons/enabledSet';
import { ThemesView } from './ThemesView';
import { offSeason } from '../themes/testClock';

// SPO-586: every framed card must ask for ITS OWN look's bundle; the real loader is wrapped so the calls can be seen
const lazy = vi.hoisted(() => ({ loaded: [] as string[] }));
vi.mock('../themes/lazy', async (orig) => {
  const real = await orig<typeof import('../themes/lazy')>();
  return {
    ...real,
    loadThemeCss: (id: string) => {
      lazy.loaded.push(id);
      return real.loadThemeCss(id);
    },
  };
});

// the looks a test installs it removes again (SPO-500)
afterEach(() => setAllowedThemes([]));

// what a test installs it removes again (SPO-500)
afterEach(() => addonsPref.reset());

offSeason();

beforeEach(() => {
  setAllowedThemes(THEMES.map((t) => t.id)); // every look installed: these tests are about wearing (SPO-500)
  setLocale('en');
  localStorage.clear();
  // The page exists from two looks on: the base one plus one installed theme.
  addonsPref.set(['theme-cyberpunk']);
  document.documentElement.removeAttribute('data-theme');
});
afterEach(cleanup);

describe('ThemesView', () => {
  it('draws each theme as its name set as a wordmark, with no screenshot and no user data', () => {
    const { container } = render(<ThemesView onClose={() => undefined} />);
    expect(container.querySelector('.thm-wm')?.textContent).toBe('Studio');
    expect(container.querySelector('img, .thm-pv, .thm-pv-in')).toBeNull();
  });

  it('puts the theme in use first, as an Applied button (aria-disabled), without a Current tag', () => {
    const { container } = render(<ThemesView onClose={() => undefined} />);
    expect(container.querySelector('.thm-cell')?.classList.contains('thm-hero')).toBe(true);
    expect(
      screen.getByText(en.themesApplied).closest('button')?.getAttribute('aria-disabled') ===
        'true',
    ).toBe(true);
    expect(screen.queryByText('Current')).toBeNull();
  });

  it('holds places for the themes still to come', () => {
    render(<ThemesView onClose={() => undefined} />);
    expect(screen.getAllByText(en.themesSoon)).toHaveLength(3);
  });
});

describe("ThemesView cards and the looks' bundles (SPO-586)", () => {
  beforeEach(() => {
    lazy.loaded.length = 0;
    initTheme();
  });

  it("every framed card asks for its own look's bundle, and the look in use needs no frame", async () => {
    // the test installs one look besides the base (beforeEach): Cyberpunk
    const { container } = render(<ThemesView onClose={() => undefined} />);
    const titles = [...container.querySelectorAll('iframe.thm-frame')].map(
      (f) => (f as HTMLIFrameElement).title,
    );
    expect(titles).toEqual(['Cyberpunk']);
    await vi.waitFor(() => expect(lazy.loaded).toEqual(['cyberpunk']));
    expect(lazy.loaded).not.toContain('studio');
  });

  it('after Apply the look in use is the first card and the only Applied one; the previous look becomes a framed card with Apply', async () => {
    const { container } = render(<ThemesView onClose={() => undefined} />);
    await act(async () => {
      setTheme('cyberpunk');
    });
    expect(container.querySelector('.thm-hero .thm-wm')?.textContent).toBe('Cyberpunk');
    expect(screen.getAllByText(en.themesApplied)).toHaveLength(1);
    const titles = [...container.querySelectorAll('iframe.thm-frame')].map(
      (f) => (f as HTMLIFrameElement).title,
    );
    expect(titles).toEqual(['Studio']);
    await vi.waitFor(() => expect(lazy.loaded).toContain('studio'));
  });
});

describe('ThemesView during a holiday theme (SPO-321)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 28, 12));
    document.documentElement.lang = 'en';
    initTheme();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists the holiday theme first as seasonal and marks no pickable card as in use: the saved theme is veiled', () => {
    const { container } = render(<ThemesView onClose={() => undefined} />);
    // the scheduled holiday theme is shown (not pickable): its tag and an Applied button
    expect(screen.getByText('Halloween')).toBeTruthy();
    expect(screen.getByText(en.themesSeasonal)).toBeTruthy();
    expect(screen.getAllByText(en.themesApplied)).toHaveLength(1);
    // every pickable theme is a framed card in its own document
    expect(container.querySelectorAll('iframe.thm-frame')).toHaveLength(2);
    expect(screen.queryAllByText(en.themesApply)).toHaveLength(0); // buttons live inside the frames
  });

  it('keeps the holiday card for the whole window after the person chose their own theme: framed, with Apply', () => {
    initTheme();
    act(() => setTheme('cyberpunk'));
    const { container } = render(<ThemesView onClose={() => undefined} />);
    expect(screen.getByTitle('Halloween')).toBeTruthy(); // a framed card: its name lives in its own document
    // the holiday card is no longer worn: it is a framed card like the others, and the saved theme is the one in use
    expect(container.querySelectorAll('iframe.thm-frame')).toHaveLength(2);
    expect(screen.getAllByText(en.themesApplied)).toHaveLength(1);
  });

  it('the framed holiday card is tagged Seasonal (not "on now") and Apply on it puts the holiday theme back', async () => {
    initTheme();
    act(() => setTheme('cyberpunk'));
    render(<ThemesView onClose={() => undefined} />);
    const f = screen.getByTitle('Halloween') as HTMLIFrameElement;
    await vi.waitFor(() =>
      expect(f.contentDocument?.body.textContent).toContain(en.themesSeasonalOff),
    );
    expect(f.contentDocument?.body.textContent).not.toContain('on now');
  });

  it('shows no holiday card once the window is over', () => {
    vi.setSystemTime(new Date(2026, 10, 1, 12));
    initTheme();
    render(<ThemesView onClose={() => undefined} />);
    expect(screen.queryByText(en.themesSeasonal)).toBeNull();
  });
});
