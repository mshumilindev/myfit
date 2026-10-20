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

import { HttpError } from '../api';
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

describe('AuthView: signing in', () => {
  it('probes reachability with a 6 s timeout on open', async () => {
    render(<AuthView onLoggedIn={vi.fn()} />);
    await act(async () => {});
    expect(h.callFn).toHaveBeenCalledWith('authStatus', undefined, { timeoutMs: 6000 });
    expect(document.querySelector('.banner')).toBeNull();
  });

  it('sends the trimmed username with the password, signs in with the payload and reports success', async () => {
    const onLoggedIn = vi.fn();
    render(<AuthView onLoggedIn={onLoggedIn} />);
    fill();
    await submit();
    expect(h.callFn).toHaveBeenCalledWith('login', { identifier: 'me', password: 'secret1' });
    expect(h.signIn).toHaveBeenCalledWith({ token: 't' }, false);
    expect(onLoggedIn).toHaveBeenCalledTimes(1);
  });

  it('passes "Remember me" to the sign-in: off by default, on when ticked', async () => {
    render(<AuthView onLoggedIn={vi.fn()} />);
    const box = screen.getByRole('checkbox', { name: new RegExp(en.authRememberMe) }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    fill();
    await submit();
    expect(h.signIn).toHaveBeenCalledWith({ token: 't' }, true);
  });

  it('shows "Signing in…" and ignores a second submit while the call is pending', async () => {
    let done!: (v: unknown) => void;
    loginResult = () => new Promise((r) => (done = r));
    render(<AuthView onLoggedIn={vi.fn()} />);
    fill();
    await submit();
    expect(signInBtn().textContent).toBe(en.signingIn);
    expect((signInBtn() as HTMLButtonElement).disabled).toBe(true);
    expect(user().disabled).toBe(true);
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    expect(h.callFn.mock.calls.filter((c) => c[0] === 'login')).toHaveLength(1);
    await act(async () => done({ token: 't' }));
    expect(signInBtn().textContent).toBe(en.signIn);
  });

  it('a 401 says the credentials are wrong and keeps the form usable', async () => {
    loginResult = async () => {
      throw new HttpError(401, 'nope');
    };
    const onLoggedIn = vi.fn();
    render(<AuthView onLoggedIn={onLoggedIn} />);
    fill();
    await submit();
    expect(screen.getByText(en.wrongCredentials)).toBeTruthy();
    expect(onLoggedIn).not.toHaveBeenCalled();
    expect(user().disabled).toBe(false);
  });

  it('another HTTP error shows its message, or the generic error when it has none', async () => {
    loginResult = async () => {
      throw new HttpError(500, 'Server on fire');
    };
    render(<AuthView onLoggedIn={vi.fn()} />);
    fill();
    await submit();
    expect(screen.getByText('Server on fire')).toBeTruthy();
    loginResult = async () => {
      throw new HttpError(500, '');
    };
    await submit();
    expect(screen.getByText(en.error)).toBeTruthy();
  });

  it('a Firebase sign-in failure is shown without its "Firebase:" prefix', async () => {
    h.signIn.mockRejectedValue(new Error('Firebase: Error (auth/network-request-failed).'));
    render(<AuthView onLoggedIn={vi.fn()} />);
    fill();
    await submit();
    expect(screen.getByText('Error (auth/network-request-failed).')).toBeTruthy();
  });

  it('a non-Error rejection is stringified; an empty one falls back to the generic error', async () => {
    h.signIn.mockRejectedValue('boom');
    render(<AuthView onLoggedIn={vi.fn()} />);
    fill();
    await submit();
    expect(screen.getByText('boom')).toBeTruthy();
    h.signIn.mockRejectedValue('');
    await submit();
    expect(screen.getByText(en.error)).toBeTruthy();
  });
});

describe('AuthView: too many attempts', () => {
  const lock = async () => {
    loginResult = async () => {
      throw new HttpError(429, 'slow down');
    };
    render(<AuthView onLoggedIn={vi.fn()} />);
    fill();
    await submit();
  };

  it('a 429 locks the form for 15 minutes with a ticking countdown', async () => {
    await lock();
    expect(screen.getByText(en.tooManyAttempts)).toBeTruthy();
    expect(document.querySelector('.banner .num')?.textContent).toBe('15:00');
    expect(user().disabled).toBe(true);
    expect(pass().disabled).toBe(true);
    expect((signInBtn() as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(document.querySelector('.banner .num')?.textContent).toBe('13:59');
  });

  it('unlocks when the 15 minutes are over', async () => {
    await lock();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000 + 1000);
    });
    expect(screen.queryByText(en.tooManyAttempts)).toBeNull();
    expect(user().disabled).toBe(false);
  });

  it('a previous error is hidden while locked', async () => {
    loginResult = async () => {
      throw new HttpError(401, '');
    };
    render(<AuthView onLoggedIn={vi.fn()} />);
    fill();
    await submit();
    expect(screen.getByText(en.wrongCredentials)).toBeTruthy();
    loginResult = async () => {
      throw new HttpError(429, '');
    };
    await submit();
    expect(screen.queryByText(en.wrongCredentials)).toBeNull();
  });
});

describe('AuthView: reachability', () => {
  it('offline: shows the unreachable banner, disables the form and offers Retry', async () => {
    setOnline(false);
    h.callFn.mockRejectedValue(new Error('net'));
    render(<AuthView onLoggedIn={vi.fn()} />);
    await act(async () => {});
    expect(screen.getByText(en.serverUnreachable)).toBeTruthy();
    expect(user().disabled).toBe(true);
    expect((signInBtn() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: en.retry })).toBeTruthy();
  });

  it('Retry probes again and clears the banner once the server answers', async () => {
    setOnline(false);
    h.callFn.mockRejectedValue(new Error('net'));
    render(<AuthView onLoggedIn={vi.fn()} />);
    await act(async () => {});
    setOnline(true);
    h.callFn.mockResolvedValue({ registered: true });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.retry }));
    });
    expect(screen.queryByText(en.serverUnreachable)).toBeNull();
    expect(user().disabled).toBe(false);
  });

  it('coming back online re-checks on its own', async () => {
    setOnline(false);
    h.callFn.mockRejectedValue(new Error('net'));
    render(<AuthView onLoggedIn={vi.fn()} />);
    await act(async () => {});
    expect(screen.getByText(en.serverUnreachable)).toBeTruthy();
    setOnline(true);
    h.callFn.mockResolvedValue({ registered: true });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(en.serverUnreachable)).toBeNull();
  });

  it.each([503, 504])(
    'a %i from an online browser shows the slow hint but keeps sign-in enabled',
    async (status) => {
      h.callFn.mockRejectedValue(new HttpError(status, ''));
      render(<AuthView onLoggedIn={vi.fn()} />);
      await act(async () => {});
      expect(screen.getByText(en.authSlowHint)).toBeTruthy();
      expect(screen.queryByText(en.serverUnreachable)).toBeNull();
      expect(user().disabled).toBe(false);
      expect(screen.getByRole('button', { name: en.retry })).toBeTruthy();
    },
  );

  it('other probe errors while online show nothing', async () => {
    h.callFn.mockRejectedValue(new HttpError(500, ''));
    render(<AuthView onLoggedIn={vi.fn()} />);
    await act(async () => {});
    expect(document.querySelector('.banner')).toBeNull();
    expect(screen.queryByRole('button', { name: en.retry })).toBeNull();
  });

  it('Retry clears the slow hint while it re-checks', async () => {
    h.callFn.mockRejectedValue(new HttpError(504, ''));
    render(<AuthView onLoggedIn={vi.fn()} />);
    await act(async () => {});
    h.callFn.mockResolvedValue({ registered: true });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.retry }));
    });
    expect(screen.queryByText(en.authSlowHint)).toBeNull();
  });
});
