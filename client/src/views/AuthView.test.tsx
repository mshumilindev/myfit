import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  callFn: vi.fn(),
  signIn: vi.fn(async () => undefined),
}));
vi.mock('../api', () => ({
  HttpError: class HttpError extends Error {
    status = 0;
  },
  callFn: h.callFn,
  signInWithPayload: h.signIn,
}));

import { AuthView } from './AuthView';
import { setLocale } from '../i18n';

beforeEach(() => setLocale('en'));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AuthView', () => {
  it('the sign-in button submits the form (a click must start the login)', async () => {
    h.callFn.mockImplementation(async (name: string) =>
      name === 'login'
        ? { token: 't', userId: 'u', username: 'me', name: 'Me', role: 'member' }
        : { registered: true },
    );
    const onLoggedIn = vi.fn();
    render(<AuthView onLoggedIn={onLoggedIn} />);
    const [user, pass] = screen
      .getAllByRole('textbox')
      .concat(Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]')));
    fireEvent.change(user, { target: { value: 'me' } });
    fireEvent.change(pass, { target: { value: 'secret1' } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sign in/i }).hasAttribute('disabled')).toBe(false),
    );
    const btn = screen.getByRole('button', { name: /sign in/i });
    expect(btn.getAttribute('type')).toBe('submit');
    fireEvent.click(btn);
    await waitFor(() => expect(onLoggedIn).toHaveBeenCalled());
    expect(h.callFn).toHaveBeenCalledWith('login', { identifier: 'me', password: 'secret1' });
  });
});
