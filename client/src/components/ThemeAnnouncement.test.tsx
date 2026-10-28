import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { en } from '../i18n/en';
import { getPreview, initTheme, startPreview } from '../themes';
import { getUnseenThemes, resetSeenForTest, syncSeenFromDoc } from '../themes/seen';
import { offSeason } from '../themes/testClock';
import { ThemeInvite, ThemePreviewHost } from './ThemeAnnouncement';

const attr = () => document.documentElement.getAttribute('data-theme');

offSeason();

beforeEach(() => {
  localStorage.clear();
  resetSeenForTest();
  initTheme();
});
afterEach(cleanup);

describe('ThemeInvite', () => {
  it('shows nothing until the account’s seen list is known', () => {
    const { container } = render(<ThemeInvite />);
    expect(container.querySelector('.thinv')).toBeNull();
  });

  it('shows the invite (drawn in the new theme’s frame) when a theme is new', () => {
    act(() => syncSeenFromDoc({}, () => undefined));
    const { container } = render(<ThemeInvite />);
    expect(container.querySelector('.thinv iframe')?.getAttribute('title')).toBe('Cyberpunk');
  });

  it('shows nothing once the theme was seen, or while a preview is running', () => {
    act(() => syncSeenFromDoc({ themesSeen: ['cyberpunk'] }, () => undefined));
    const { container, rerender } = render(<ThemeInvite />);
    expect(container.querySelector('.thinv')).toBeNull();
    act(() => syncSeenFromDoc({ themesSeen: [] }, () => undefined));
    rerender(<ThemeInvite />);
    expect(container.querySelector('.thinv')).toBeNull(); // union never shrinks: still seen
  });
});

describe('ThemePreviewHost', () => {
  it('renders nothing without a preview', () => {
    render(<ThemePreviewHost />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('Keep current: theme back, the previewed one counts as seen, nothing saved', () => {
    act(() => syncSeenFromDoc({}, () => undefined));
    render(<ThemePreviewHost />);
    act(() => startPreview('cyberpunk'));
    expect(attr()).toBe('cyberpunk');
    fireEvent.click(screen.getByRole('button', { name: en.themePreviewKeep }));
    expect(attr()).toBe('glass');
    expect(getPreview()).toBeNull();
    expect(localStorage.getItem('gym.theme')).toBeNull();
    expect(getUnseenThemes()).toEqual([]);
  });

  it('a preview does not follow the person into a workout: the look goes back, nothing is saved', () => {
    window.history.pushState(null, '', '/session');
    render(<ThemePreviewHost />);
    act(() => startPreview('cyberpunk'));
    expect(attr()).toBe('glass');
    expect(getPreview()).toBeNull();
    expect(localStorage.getItem('gym.theme')).toBeNull();
    window.history.pushState(null, '', '/');
  });

  it('Use: the theme is saved and the dock goes away', () => {
    render(<ThemePreviewHost />);
    act(() => startPreview('cyberpunk'));
    fireEvent.click(screen.getByRole('button', { name: en.themePreviewUse('Cyberpunk') }));
    expect(attr()).toBe('cyberpunk');
    expect(localStorage.getItem('gym.theme')).toBe('cyberpunk');
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('Esc is Keep current (theme back, previewed one seen, nothing saved)', () => {
    act(() => syncSeenFromDoc({}, () => undefined));
    render(<ThemePreviewHost />);
    act(() => startPreview('cyberpunk'));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(attr()).toBe('glass');
    expect(getPreview()).toBeNull();
    expect(localStorage.getItem('gym.theme')).toBeNull();
    expect(getUnseenThemes()).toEqual([]);
  });

  it('Esc inside a text field or a dialog is left to it, and other keys do nothing', () => {
    render(
      <>
        <ThemePreviewHost />
        <input aria-label="note" />
        <div role="dialog">
          <button>x</button>
        </div>
      </>,
    );
    act(() => startPreview('cyberpunk'));
    fireEvent.keyDown(screen.getByLabelText('note'), { key: 'Escape' });
    fireEvent.keyDown(screen.getByText('x'), { key: 'Escape' });
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(getPreview()).toBe('cyberpunk');
    expect(screen.getByRole('region')).toBeTruthy();
  });
});
