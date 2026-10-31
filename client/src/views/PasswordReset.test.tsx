import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ callFn: vi.fn() }));
vi.mock('../api', () => {
  class HttpError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return { callFn: h.callFn, HttpError, signInWithPayload: vi.fn() };
});

import { HttpError } from '../api';
import { setLocale } from '../i18n';
import { AuthView } from './AuthView';
import { ForgotPasswordView } from './ForgotPasswordView';
import { ResetPasswordView } from './ResetPasswordView';

beforeEach(() => setLocale('en'));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const type = (ph: string, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(ph), { target: { value } });

describe('sign-in form link', () => {
  it('opens the forgot-password form and comes back', async () => {
    h.callFn.mockResolvedValue({ registered: true });
    render(<AuthView onLoggedIn={() => undefined} />);
    fireEvent.click(screen.getByText('Forgot your password?'));
    expect(screen.getByText('Reset your password')).toBeTruthy();
    fireEvent.click(screen.getByText('Back to sign in'));
    expect(await screen.findByText('Forgot your password?')).toBeTruthy();
  });
});

describe('ForgotPasswordView', () => {
  it('asks the server, then shows "Check your inbox" with a countdown to the next letter', async () => {
    h.callFn.mockResolvedValue({ ok: true });
    render(<ForgotPasswordView onBack={() => undefined} />);
    type('Email', 'ada@example.com');
    fireEvent.click(screen.getByText('Send the link'));
    expect(await screen.findAllByText('Check your inbox')).toBeTruthy();
    expect(h.callFn).toHaveBeenCalledWith('requestPasswordReset', {
      email: 'ada@example.com',
      locale: 'en',
    });
    expect(screen.getByText(/Send again in \d+ s/)).toBeTruthy();
  });
  it('does not call the server for a malformed address', () => {
    render(<ForgotPasswordView onBack={() => undefined} />);
    type('Email', 'nope');
    fireEvent.click(screen.getByText('Send the link'));
    expect(screen.getByRole('alert').textContent).toContain('Enter a valid email address.');
    expect(h.callFn).not.toHaveBeenCalled();
  });
  it('maps a rate-limit answer to its sentence', async () => {
    h.callFn.mockRejectedValue(new HttpError(429, 'x'));
    render(<ForgotPasswordView onBack={() => undefined} />);
    type('Email', 'ada@example.com');
    fireEvent.click(screen.getByText('Send the link'));
    expect(await screen.findByText('Too many attempts. Try again in 15 minutes.')).toBeTruthy();
  });
});

describe('ResetPasswordView', () => {
  const view = (live = true) => {
    const onSignIn = vi.fn();
    const onNewLink = vi.fn();
    render(<ResetPasswordView token="tok" live={live} onSignIn={onSignIn} onNewLink={onNewLink} />);
    return { onSignIn, onNewLink };
  };
  it('checks the length and the repeat before calling the server', () => {
    view();
    type('New password', '123');
    type('Repeat the new password', '123');
    fireEvent.click(screen.getByText('Save password'));
    expect(screen.getByRole('alert').textContent).toContain('6 to 72 characters.');
    type('New password', 'longenough');
    type('Repeat the new password', 'different1');
    fireEvent.click(screen.getByText('Save password'));
    expect(screen.getByRole('alert').textContent).toContain('The passwords do not match.');
    expect(h.callFn).not.toHaveBeenCalled();
  });
  it('saves the password without signing the person in, then offers sign in', async () => {
    h.callFn.mockResolvedValue({ userId: 'u' });
    const { onSignIn } = view();
    type('New password', 'longenough');
    type('Repeat the new password', 'longenough');
    fireEvent.click(screen.getByText('Save password'));
    expect(await screen.findByText('Password changed')).toBeTruthy();
    expect(h.callFn).toHaveBeenCalledWith('claim', { token: 'tok', password: 'longenough' });
    fireEvent.click(screen.getByText('Sign in'));
    expect(onSignIn).toHaveBeenCalled();
  });
  it('shows the dead-link screen when the server says the link is gone, and offers a new link', async () => {
    h.callFn.mockRejectedValue(new HttpError(400, 'link no longer valid'));
    const { onNewLink } = view();
    type('New password', 'longenough');
    type('Repeat the new password', 'longenough');
    fireEvent.click(screen.getByText('Save password'));
    await waitFor(() => expect(screen.getByText('This link no longer works')).toBeTruthy());
    fireEvent.click(screen.getByText('Get a new link'));
    expect(onNewLink).toHaveBeenCalled();
  });
  it('opens straight on the dead-link screen for an expired or used link', () => {
    view(false);
    expect(screen.getByText('The link was already used or has expired.')).toBeTruthy();
  });
});
