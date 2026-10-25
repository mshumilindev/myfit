import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { ThemesView } from './ThemesView';
import { setTheme } from '../themes';

beforeEach(() => setLocale('en'));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ThemesView chrome', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  /** Another theme's card lives in its own document (an iframe), drawn in that theme. */
  const frameOf = async (title: string) => {
    const f = (await screen.findByTitle(title)) as HTMLIFrameElement;
    await waitFor(() => expect(f.contentDocument?.body.textContent).toContain(title));
    return within(f.contentDocument!.body);
  };

  it('back closes the page; the current theme is applied, the others offer Apply', async () => {
    const onClose = vi.fn();
    render(<ThemesView onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Brass Glass')).toBeTruthy();
    const cyber = await frameOf('Cyberpunk');
    expect(cyber.getByText(en.themesApply)).toBeTruthy();
    // the card is drawn in ITS theme, not the page's
    const doc = (screen.getByTitle('Cyberpunk') as HTMLIFrameElement).contentDocument!;
    expect(doc.documentElement.getAttribute('data-theme')).toBe('cyberpunk');
    expect(
      (screen.getByText(en.themesApplied).closest('button') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('Apply switches the theme and puts the tapped theme first', async () => {
    render(<ThemesView onClose={vi.fn()} />);
    const cyber = await frameOf('Cyberpunk');
    fireEvent.click(cyber.getByText(en.themesApply));
    expect(document.documentElement.getAttribute('data-theme')).toBe('cyberpunk');
    expect(localStorage.getItem('gym.theme')).toBe('cyberpunk');
    // the roles swap: Brass Glass is now the framed card with Apply, Cyberpunk the live one
    const glass = await frameOf('Brass Glass');
    expect(glass.getByText(en.themesApply)).toBeTruthy();
    expect(document.querySelector('.thm-hero')?.textContent).toContain('Cyberpunk');
    act(() => setTheme('glass'));
  });
});
