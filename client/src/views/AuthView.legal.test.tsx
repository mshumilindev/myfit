import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  HttpError: class HttpError extends Error {
    status = 0;
  },
  callFn: vi.fn(async () => ({ registered: true })),
  signInWithPayload: vi.fn(),
}));

import { AuthView } from './AuthView';
import { setLocale } from '../i18n';

beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('AuthView legal footer', () => {
  it('links to the Privacy Policy and the Terms of Use (public pages)', () => {
    render(<AuthView onLoggedIn={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Legal' });
    expect(within(nav).getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
      '#/privacy',
    );
    expect(within(nav).getByRole('link', { name: 'Terms of Use' }).getAttribute('href')).toBe(
      '#/terms',
    );
  });

  it('has no "ask your trainer for an invite link" line (owner request 22.10)', () => {
    for (const l of ['en', 'uk', 'pl', 'lt', 'et'] as const) {
      setLocale(l);
      const { container, unmount } = render(<AuthView onLoggedIn={vi.fn()} />);
      expect(container.querySelector('.footer-link')).toBeNull();
      expect(container.textContent).not.toMatch(/invite|запрош|zaproszen|pakvietim|kutse/i);
      unmount();
    }
  });

  it('follows the app language', () => {
    setLocale('pl');
    render(<AuthView onLoggedIn={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Informacje prawne' });
    expect(within(nav).getByRole('link', { name: 'Polityka prywatności' })).toBeTruthy();
  });
});
