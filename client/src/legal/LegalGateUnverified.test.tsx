import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../api', () => ({
  currentUid: () => 'u1',
  onAuthChange: () => () => undefined,
  signOut: vi.fn(),
}));

import { CHECK_TIMEOUT_MS, LegalGateUnverified } from './LegalGateUnverified';

function setOnline(v: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value: v, configurable: true });
}
function fire(name: 'online' | 'offline', v: boolean) {
  setOnline(v);
  act(() => {
    window.dispatchEvent(new Event(name));
  });
}
const coded = (code: string) => Object.assign(new Error('boom /users/u1/x'), { code });
const mount = (error: Error | null = null, onRetry = vi.fn()) => {
  const r = render(<LegalGateUnverified error={error} onRetry={onRetry} onSignOut={vi.fn()} />);
  return { ...r, onRetry };
};
const retryBtn = () =>
  screen.queryByRole('button', { name: 'Try again' }) as HTMLButtonElement | null;

beforeEach(() => {
  vi.useFakeTimers();
  setOnline(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setOnline(true);
});

describe('LegalGateUnverified', () => {
  it('online and waiting: says "checking" with a busy spinner, keeps Sign out / Delete', () => {
    mount();
    expect(screen.getByRole('alertdialog', { name: 'Checking your agreement' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/Checking your agreement/);
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(retryBtn()?.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeTruthy();
    expect(screen.queryByText(/Connect to the internet/)).toBeNull();
  });

  it('offline: asks to connect, no retry button, no diagnostic code', () => {
    setOnline(false);
    mount(coded('unavailable'));
    expect(screen.getByRole('alertdialog', { name: 'Connect to continue' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/Connect to the internet/);
    expect(retryBtn()).toBeNull();
    expect(screen.queryByText(/Code:/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('online with a listener error: service problem with the error code (never the message) and Try again', () => {
    const { onRetry } = mount(coded('permission-denied'));
    expect(
      screen.getByRole('alertdialog', { name: "We couldn't check your agreement" }),
    ).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(
      /problem on our side or with your connection/,
    );
    expect(screen.queryByText(/Connect to the internet/)).toBeNull();
    expect(screen.getByText('Code: permission-denied')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/boom|\/users\//);
    expect(retryBtn()?.disabled).toBe(false);
    fireEvent.click(retryBtn()!);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('online and still waiting after 8 s: becomes a service problem with code "timeout"; Try again restarts the wait', () => {
    const { onRetry } = mount();
    act(() => {
      vi.advanceTimersByTime(CHECK_TIMEOUT_MS - 1);
    });
    expect(screen.getByRole('alertdialog', { name: 'Checking your agreement' })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(
      screen.getByRole('alertdialog', { name: "We couldn't check your agreement" }),
    ).toBeTruthy();
    expect(screen.getByText('Code: timeout')).toBeTruthy();
    fireEvent.click(retryBtn()!);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alertdialog', { name: 'Checking your agreement' })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(CHECK_TIMEOUT_MS);
    });
    expect(screen.getByText('Code: timeout')).toBeTruthy();
  });

  it('an error without a code shows no code line', () => {
    mount(new Error('x'));
    expect(
      screen.getByRole('alertdialog', { name: "We couldn't check your agreement" }),
    ).toBeTruthy();
    expect(screen.queryByText(/Code:/)).toBeNull();
  });

  it('follows the connection: online -> offline -> online retries by itself', () => {
    const { onRetry } = mount(coded('unavailable'));
    expect(
      screen.getByRole('alertdialog', { name: "We couldn't check your agreement" }),
    ).toBeTruthy();
    fire('offline', false);
    expect(screen.getByRole('alertdialog', { name: 'Connect to continue' })).toBeTruthy();
    expect(onRetry).not.toHaveBeenCalled();
    fire('online', true);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('alertdialog', { name: "We couldn't check your agreement" }),
    ).toBeTruthy();
  });
});
