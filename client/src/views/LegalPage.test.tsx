import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { LEGAL_WINDOW, legalBackAction } from '../legal/route';
import { currentHash } from '../route';
import { openLegalPage } from '../legal/GateLeaveActions';
import { LegalPage } from './LegalPage';

beforeEach(() => {
  setLocale('en');
  window.location.hash = '#/privacy';
  window.name = '';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Object.defineProperty(window, 'opener', { value: null, configurable: true });
  window.name = '';
});

describe('legalBackAction', () => {
  it('closes a window the app opened, goes back inside the app, else to the root', () => {
    expect(legalBackAction({ popup: true, fromApp: true })).toBe('close');
    expect(legalBackAction({ popup: true, fromApp: false })).toBe('close');
    expect(legalBackAction({ popup: false, fromApp: true })).toBe('back');
    expect(legalBackAction({ popup: false, fromApp: false })).toBe('root');
  });
});

describe('LegalPage back control', () => {
  it('with in-app history: Back uses history.back()', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    render(<LegalPage page="privacy" fromApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/privacy');
  });

  it('without history (direct link / reload): Back goes to the app root and never calls history.back()', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    render(<LegalPage page="terms" />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(back).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('opened with window.open (opener set): shows Close and closes the window', () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'opener', { value: {}, configurable: true });
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    render(<LegalPage page="privacy" />);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('opened by the app (opener cleared, window named): Close; a window that stays open falls back to the root', () => {
    vi.useFakeTimers();
    window.name = LEGAL_WINDOW;
    vi.spyOn(window, 'close').mockImplementation(() => undefined);
    render(<LegalPage page="privacy" fromApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(window.location.hash).toBe('#/privacy');
    vi.advanceTimersByTime(200);
    expect(window.location.hash).toBe('');
  });

  it('is a real button reachable by keyboard and labelled in every locale', () => {
    const labels = { en: 'Back', uk: 'Назад', pl: 'Wstecz', lt: 'Atgal', et: 'Tagasi' } as const;
    for (const [l, label] of Object.entries(labels)) {
      setLocale(l as keyof typeof labels);
      const { unmount } = render(<LegalPage page="privacy" fromApp />);
      const b = screen.getByRole('button', { name: label }) as HTMLButtonElement;
      expect(b.tagName).toBe('BUTTON');
      expect(b.tabIndex).toBeGreaterThanOrEqual(0);
      unmount();
    }
  });
});

describe('LegalPage trainer documents (SPO-289)', () => {
  it('shows the DRAFT Trainer Terms and DPA with the draft note and the shared version line', () => {
    const a = render(<LegalPage page="trainer-terms" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /Trainer Terms \(DRAFT\)/,
    );
    expect(document.body.textContent).toMatch(
      /DRAFT\. This text has not been reviewed by a lawyer/,
    );
    a.unmount();
    render(<LegalPage page="dpa" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /Data Processing Agreement/,
    );
  });

  it('opened by the sheet in its own window (#/trainer-terms): Close; in-app: Back uses history', () => {
    vi.useFakeTimers();
    window.name = LEGAL_WINDOW;
    window.location.hash = '#/trainer-terms';
    vi.spyOn(window, 'close').mockImplementation(() => undefined);
    const a = render(<LegalPage page="trainer-terms" fromApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(window.close).toHaveBeenCalledTimes(1);
    a.unmount();
    window.name = '';
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    render(<LegalPage page="dpa" fromApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('A3: same-tab fallback remembers where the person came from', () => {
  beforeEach(() => sessionStorage.clear());

  it('popup blocked from the coach: Back returns to the coach, not to the root or history', () => {
    window.location.hash = '#/c/today';
    vi.spyOn(window, 'open').mockReturnValue(null); // the browser refuses the new window
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    openLegalPage('dpa');
    expect(window.location.hash).toBe('#/dpa');
    render(<LegalPage page="dpa" fromApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(back).not.toHaveBeenCalled();
    expect(currentHash()).toBe('#/c/today'); // the app's own route reader (a clean URL may carry it)
    // once: the next Back has no stale target
    expect(sessionStorage.getItem('spotter.legalReturn')).toBeNull();
  });

  it('a window that opens stores nothing; a legal page or a token address is never stored', () => {
    window.location.hash = '#/c/today';
    vi.spyOn(window, 'open').mockReturnValue({ opener: 1 } as unknown as Window);
    openLegalPage('dpa');
    expect(sessionStorage.getItem('spotter.legalReturn')).toBeNull();
    vi.spyOn(window, 'open').mockReturnValue(null);
    window.location.hash = '#/privacy';
    openLegalPage('dpa');
    window.location.hash = '#/join/abc123?x=1';
    openLegalPage('dpa');
    expect(sessionStorage.getItem('spotter.legalReturn')).toBeNull();
  });
});
