import { cleanup, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api', () => ({
  registerSignOutFlush: () => undefined, // signupConsents registers its queues with api.ts at import
  HttpError: class HttpError extends Error {
    status = 0;
  },
  callFn: vi.fn(async () => ({ registered: true })),
  signInWithPayload: vi.fn(),
}));

import { setLocale } from '../../i18n';
import { LandingView } from './LandingView';

beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('Landing legal footer', () => {
  it('has its own footer links, also in invite mode (no sign-in form there)', () => {
    render(
      <LandingView
        onLoggedIn={vi.fn()}
        invite={{ inviter: 'Anna Coach', expiresAt: Date.UTC(2026, 11, 24), onStart: vi.fn() }}
      />,
    );
    expect(document.querySelector('form.auth-body')).toBeNull();
    const foot = document.querySelector('footer.l-foot') as HTMLElement;
    const nav = within(foot).getByRole('navigation', { name: 'Legal' });
    expect(within(nav).getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
      '#/privacy',
    );
    expect(within(nav).getByRole('link', { name: 'Terms of Use' }).getAttribute('href')).toBe(
      '#/terms',
    );
  });

  it('shows exactly one row of legal links on the sign-in landing: the card, no footer', () => {
    render(<LandingView onLoggedIn={vi.fn()} />);
    expect(document.querySelector('footer.l-foot')).toBeNull();
    const last = document.querySelectorAll('.l-cta-panel nav[aria-label="Legal"]');
    expect(last.length).toBe(1);
  });
});
