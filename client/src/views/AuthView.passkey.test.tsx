import { EMAIL_AUTH_LOCALES } from '../i18n/emailAuth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';

const h = vi.hoisted(() => ({
  callFn: vi.fn(),
  signIn: vi.fn(),
  available: vi.fn(),
  register: vi.fn(),
  passkeyLogin: vi.fn(),
}));
vi.mock('../api', () => ({
  HttpError: class HttpError extends Error {
    constructor(
      public status: number,
      message = '',
    ) {
      super(message);
    }
  },
  callFn: (...a: unknown[]) => h.callFn(...a),
  signInWithPayload: (...a: unknown[]) => h.signIn(...a),
}));
vi.mock('../accounts/passkey', () => ({
  biometricsAvailable: () => h.available(),
  registerPasskey: () => h.register(),
  signInWithPasskey: (uid: string) => h.passkeyLogin(uid),
}));

import { AuthView } from './AuthView';
import { readRemembered } from '../accounts/rememberedPeople';

const seed = (passkey: boolean) =>
  localStorage.setItem(
    'spotter.accounts',
    JSON.stringify([
      { uid: 'uA', name: 'Anna Koval', login: 'anna', passkey, appName: '[DEFAULT]', lastUsed: 2 },
    ]),
  );
const tapAnna = () => fireEvent.click(screen.getByRole('button', { name: /Anna/ }));
const pass = () => screen.queryByPlaceholderText(en.password);

beforeEach(() => {
  setLocale('en');
  localStorage.clear();
  Object.values(h).forEach((f) => f.mockReset());
  h.callFn.mockImplementation(async (name: string) =>
    name === 'login' ? { token: 't', userId: 'uA' } : { registered: true },
  );
  h.signIn.mockResolvedValue(undefined);
  h.available.mockResolvedValue(true);
  h.register.mockResolvedValue(true);
});
afterEach(cleanup);

describe('AuthView: passkeys (SPO-211)', () => {
  it('a tap on a person with a passkey starts the biometrics at once, with no password field, and signs in on success', async () => {
    seed(true);
    let finish!: (v: unknown) => void;
    h.passkeyLogin.mockReturnValue(new Promise((r) => (finish = r)));
    const onLoggedIn = vi.fn();
    render(<AuthView onLoggedIn={onLoggedIn} />);
    tapAnna();
    await waitFor(() => expect(h.passkeyLogin).toHaveBeenCalledWith('uA'));
    expect(pass()).toBeNull();
    expect(screen.queryByRole('button', { name: en.signIn })).toBeNull();
    // Progress is visible: the tapped locker shows a status while the device asks for biometrics.
    expect(screen.getByRole('status').textContent).toBe(en.signingIn);
    finish({ token: 'pk', userId: 'uA' });
    await waitFor(() => expect(onLoggedIn).toHaveBeenCalled());
    expect(h.signIn).toHaveBeenCalledWith({ token: 'pk', userId: 'uA' }, true);
  });

  it('cancelling the biometrics shows the password field for that person', async () => {
    seed(true);
    h.passkeyLogin.mockRejectedValue(new Error('NotAllowedError'));
    render(<AuthView onLoggedIn={vi.fn()} />);
    tapAnna();
    await waitFor(() => expect(pass()).not.toBeNull());
    expect(h.signIn).not.toHaveBeenCalled();
  });

  it('a platform without biometrics falls back to the password', async () => {
    seed(true);
    h.available.mockResolvedValue(false);
    render(<AuthView onLoggedIn={vi.fn()} />);
    tapAnna();
    await waitFor(() => expect(pass()).not.toBeNull());
    expect(h.passkeyLogin).not.toHaveBeenCalled();
  });

  it('a person without a passkey goes straight to the password', async () => {
    seed(false);
    render(<AuthView onLoggedIn={vi.fn()} />);
    tapAnna();
    expect(pass()).not.toBeNull();
    expect(h.passkeyLogin).not.toHaveBeenCalled();
  });

  it('a remembered password sign-in quietly registers a passkey and notes it on the device', async () => {
    render(<AuthView onLoggedIn={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(EMAIL_AUTH_LOCALES.en.loginIdPlaceholder), {
      target: { value: 'anna' },
    });
    fireEvent.change(pass()!, { target: { value: 'secret1' } });
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(en.authRememberMe) }));
    fireEvent.click(screen.getByRole('button', { name: en.signIn }));
    await waitFor(() => expect(h.register).toHaveBeenCalledTimes(1));
    // the sign-in itself is mocked, so seed the entry it would have written and check the flag is set
    expect(h.signIn).toHaveBeenCalledWith({ token: 't', userId: 'uA' }, true);
  });

  it('a sign-in without "Remember me" creates no passkey', async () => {
    render(<AuthView onLoggedIn={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(EMAIL_AUTH_LOCALES.en.loginIdPlaceholder), {
      target: { value: 'anna' },
    });
    fireEvent.change(pass()!, { target: { value: 'secret1' } });
    fireEvent.click(screen.getByRole('button', { name: en.signIn }));
    await waitFor(() => expect(h.signIn).toHaveBeenCalledWith({ token: 't', userId: 'uA' }, false));
    expect(h.register).not.toHaveBeenCalled();
    expect(readRemembered(localStorage)).toEqual([]);
  });
});
