import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';

const h = vi.hoisted(() => ({ callFn: vi.fn(), signIn: vi.fn() }));
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

import { AuthView } from './AuthView';

const NOW = new Date(2026, 8, 26, 12, 0).getTime();
const signInBtn = () =>
  screen.getByRole('button', { name: new RegExp(`^(${en.signIn}|${en.signingIn})$`) });
const user = () => screen.getByPlaceholderText(en.username) as HTMLInputElement;
const pass = () => screen.getByPlaceholderText(en.password) as HTMLInputElement;
const fill = (u = ' me ', p = 'secret1') => {
  fireEvent.change(user(), { target: { value: u } });
  fireEvent.change(pass(), { target: { value: p } });
};
const submit = async () => {
  await act(async () => {
    fireEvent.click(signInBtn());
  });
};
const setOnline = (v: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: v });

let loginResult: () => Promise<unknown>;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(NOW);
  setLocale('en');
  setOnline(true);
  h.callFn.mockReset();
  h.signIn.mockReset().mockResolvedValue(undefined);
  loginResult = async () => ({ token: 't' });
  h.callFn.mockImplementation(async (name: string) =>
    name === 'login' ? loginResult() : { registered: true },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setOnline(true);
});

describe('AuthView: Remember me', () => {
  it('passes "Remember me" to the sign-in: off by default, on when ticked', async () => {
    render(<AuthView onLoggedIn={vi.fn()} />);
    const box = screen.getByRole('checkbox', {
      name: new RegExp(en.authRememberMe),
    }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    fill();
    await submit();
    expect(h.signIn).toHaveBeenCalledWith({ token: 't' }, true);
  });
});

describe('AuthView: people this device remembers', () => {
  const seed = () =>
    localStorage.setItem(
      'spotter.accounts',
      JSON.stringify([
        { uid: 'uA', name: 'Anna Koval', login: 'anna', appName: '[DEFAULT]', lastUsed: 2 },
        { uid: 'uB', name: 'Boris', appName: '[DEFAULT]', lastUsed: 1 },
      ]),
    );
  beforeEach(() => localStorage.clear());

  it('without remembered people the plain form opens (no wall, no back pill)', () => {
    render(<AuthView onLoggedIn={vi.fn()} />);
    expect(screen.queryByRole('group', { name: en.authWallLabel })).toBeNull();
    expect(screen.queryByRole('button', { name: en.authSavedAccounts })).toBeNull();
    expect(user()).toBeTruthy();
  });

  it('with remembered people the Locker Wall opens first, without the form', () => {
    seed();
    render(<AuthView onLoggedIn={vi.fn()} />);
    expect(screen.getByRole('group', { name: en.authWallLabel })).toBeTruthy();
    expect(screen.getByText(en.authWelcomeBack)).toBeTruthy();
    expect(screen.queryByPlaceholderText(en.username)).toBeNull();
    expect(screen.queryByPlaceholderText(en.password)).toBeNull();
  });

  it("tapping a person asks for the password only and signs in with that person's login, staying remembered", async () => {
    seed();
    const onLoggedIn = vi.fn();
    render(<AuthView onLoggedIn={onLoggedIn} />);
    fireEvent.click(screen.getByRole('button', { name: en.authLockerLabel('Anna Koval', 1) }));
    expect(screen.queryByPlaceholderText(en.username)).toBeNull();
    expect(screen.getByText(en.authPersonPassword('Anna Koval'))).toBeTruthy();
    fireEvent.change(pass(), { target: { value: 'secret1' } });
    await submit();
    expect(h.callFn).toHaveBeenCalledWith('login', { identifier: 'anna', password: 'secret1' });
    expect(h.signIn).toHaveBeenCalledWith({ token: 't' }, true);
    expect(onLoggedIn).toHaveBeenCalledTimes(1);
  });

  it('a person without a stored login falls back to the plain form', () => {
    seed();
    render(<AuthView onLoggedIn={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: en.authLockerLabel('Boris', 2) }));
    expect(user()).toBeTruthy();
  });

  it('"Use another account" opens the form with a way back to the saved accounts', () => {
    seed();
    render(<AuthView onLoggedIn={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: en.authUseAnother }));
    expect(user()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.authSavedAccounts }));
    expect(screen.getByRole('group', { name: en.authWallLabel })).toBeTruthy();
    expect(screen.queryByPlaceholderText(en.username)).toBeNull();
  });
});
