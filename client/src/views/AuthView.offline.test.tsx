import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ callFn: vi.fn() }));
vi.mock('../api', () => ({
  HttpError: class HttpError extends Error {
    constructor(
      public status: number,
      message = '',
    ) {
      super(message);
    }
  },
  callFn: h.callFn,
  signInWithPayload: vi.fn(async () => undefined),
}));

import { AuthView } from './AuthView';
import { HttpError } from '../api';
import { setLocale } from '../i18n';

beforeEach(() => setLocale('en'));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

const signIn = () => screen.getByRole('button', { name: /sign in/i });

describe('AuthView on a bad network (first sign-in, no cached session)', () => {
  it('a reachability probe that never answers does not block the form', () => {
    h.callFn.mockImplementation(() => new Promise(() => undefined));
    render(<AuthView onLoggedIn={() => undefined} />);
    expect(signIn().hasAttribute('disabled')).toBe(false);
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('a timed-out probe shows a hint with Retry and keeps sign-in enabled', async () => {
    h.callFn.mockRejectedValue(new HttpError(504, 'timeout'));
    render(<AuthView onLoggedIn={() => undefined} />);
    await screen.findByText(/slow to answer/i);
    expect(signIn().hasAttribute('disabled')).toBe(false);
    h.callFn.mockResolvedValue({ registered: true });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.queryByText(/slow to answer/i)).toBeNull());
  });

  it('offline shows the offline message with Retry', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    h.callFn.mockRejectedValue(new HttpError(503, 'offline'));
    render(<AuthView onLoggedIn={() => undefined} />);
    await screen.findByText(/can't reach the server/i);
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
    expect(signIn().hasAttribute('disabled')).toBe(true);
  });

  it('the connection dropping under the open form shows the offline message at once', async () => {
    h.callFn.mockResolvedValue({ registered: true });
    render(<AuthView onLoggedIn={() => undefined} />);
    await waitFor(() => expect(h.callFn).toHaveBeenCalled());
    expect(screen.queryByText(/can't reach the server/i)).toBeNull();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    fireEvent(window, new Event('offline'));
    await screen.findByText(/can't reach the server/i);
    h.callFn.mockResolvedValue({ registered: true });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(screen.queryByText(/can't reach the server/i)).toBeNull());
  });
});
