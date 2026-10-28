import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { setLocale } from '../i18n';

// SPO-336 F3: the reachability probe is one request however many sign-in forms open together (landing + auth shell).
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
  callFn: (...a: unknown[]) => h.callFn(...a),
  signInWithPayload: vi.fn(),
}));

import { AuthView } from './AuthView';

beforeEach(() => {
  setLocale('en');
  h.callFn.mockReset().mockResolvedValue({ registered: true });
});
afterEach(cleanup);

describe('AuthView reachability probe (SPO-336 F3)', () => {
  it('two forms opening together send one authStatus', async () => {
    render(
      <>
        <AuthView onLoggedIn={vi.fn()} />
        <AuthView onLoggedIn={vi.fn()} />
      </>,
    );
    await act(async () => {});
    expect(h.callFn.mock.calls.filter((c) => c[0] === 'authStatus')).toHaveLength(1);
  });

  it('a later probe (back online, Retry) asks again once the first has finished', async () => {
    const { unmount } = render(<AuthView onLoggedIn={vi.fn()} />);
    await act(async () => {});
    unmount();
    render(<AuthView onLoggedIn={vi.fn()} />);
    await act(async () => {});
    expect(h.callFn.mock.calls.filter((c) => c[0] === 'authStatus')).toHaveLength(2);
  });
});
