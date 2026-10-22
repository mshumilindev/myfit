import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api', () => ({
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

describe('LandingView', () => {
  it('shows the headline and the real sign-in form in the hero', () => {
    render(<LandingView onLoggedIn={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('spotlight');
    expect(document.querySelector('form.auth-body')).not.toBeNull();
    // the hero and the last screen each carry the real form
    expect(screen.getAllByRole('button', { name: 'Sign in' })).toHaveLength(2);
  });

  it('has no "I have an invite" button (the invite link opens its own page)', () => {
    render(<LandingView onLoggedIn={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'I have an invite' })).toBeNull();
  });

  it('offers the three downloads', () => {
    render(<LandingView onLoggedIn={vi.fn()} />);
    for (const name of ['Windows', 'macOS', 'Android']) expect(screen.getAllByText(name).length).toBeGreaterThan(0);
  });

  it('invite mode replaces the form with the personalised step 0', () => {
    const onStart = vi.fn();
    render(
      <LandingView
        onLoggedIn={vi.fn()}
        invite={{ inviter: 'Anna Coach', expiresAt: Date.UTC(2026, 11, 24), onStart }}
      />,
    );
    expect(document.querySelector('form.auth-body')).toBeNull();
    expect(screen.getAllByText('Anna Coach').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /Start/ })[0]);
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
