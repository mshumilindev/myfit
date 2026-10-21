import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { setLocale } from '../i18n';

vi.mock('../api', () => ({
  HttpError: class HttpError extends Error {},
  callFn: async () => ({ registered: true, sessions: [] }),
  signInWithPayload: async () => undefined,
}));
vi.mock('../accounts/passkey', () => ({
  biometricsAvailable: async () => false,
  registerPasskey: async () => false,
  signInWithPasskey: async () => {
    throw new Error('x');
  },
}));
vi.mock('../accounts/sessions', async (orig) => ({
  ...(await orig<typeof import('../accounts/sessions')>()),
  listSessions: async () => [
    {
      deviceId: 'this-device-id',
      label: 'Chrome · macOS',
      city: 'warsaw',
      country: 'PL',
      lastSeenAt: Date.now(),
      createdAt: 1,
    },
    {
      deviceId: 'phone-device-1',
      label: 'Safari · iOS',
      city: null,
      country: 'UA',
      lastSeenAt: Date.now() - 3_600_000,
      createdAt: 1,
    },
  ],
  sessionDeviceId: () => 'this-device-id',
}));

import { AuthView } from './AuthView';
import { SessionsSheet } from '../components/SessionsSheet';

/** axe in jsdom: contrast needs real layout, so it is off here; everything else runs. */
async function violations(el: HTMLElement) {
  const r = await axe.run(el, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

const seed = () =>
  localStorage.setItem(
    'spotter.accounts',
    JSON.stringify([
      { uid: 'uA', name: 'Anna Koval', login: 'anna', appName: '[DEFAULT]', lastUsed: 3 },
      { uid: 'uB', name: 'Boris Lee', login: 'boris', appName: '[DEFAULT]', lastUsed: 2 },
    ]),
  );

beforeEach(() => {
  setLocale('en');
  localStorage.clear();
});
afterEach(cleanup);

describe('a11y (axe): sign-in screens and Sessions', () => {
  it('the plain sign-in form', async () => {
    const { container } = render(<AuthView onLoggedIn={() => undefined} />);
    expect(await violations(container)).toEqual([]);
  });

  it('the Locker Wall', async () => {
    seed();
    const { container } = render(<AuthView onLoggedIn={() => undefined} />);
    expect(await violations(container)).toEqual([]);
  });

  it('the picked person with the password field', async () => {
    seed();
    const { container } = render(<AuthView onLoggedIn={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Anna/ }));
    await screen.findByPlaceholderText('Password');
    expect(await violations(container)).toEqual([]);
  });

  it('the form with the back pill to the saved people', async () => {
    seed();
    const { container } = render(<AuthView onLoggedIn={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Boris/ }));
    fireEvent.click(await screen.findByRole('button', { name: /use another/i }));
    expect(screen.getByRole('button', { name: /saved accounts/i })).toBeTruthy();
    expect(await violations(container)).toEqual([]);
  });

  it('the Sessions sheet', async () => {
    render(<SessionsSheet onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByText('Safari · iOS')).toBeTruthy());
    expect(await violations(document.body)).toEqual([]);
  });

  it('control: the same check does catch a real problem (image without alt)', async () => {
    const { container } = render(<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />);
    expect((await violations(container)).join()).toMatch(/image-alt/);
  });
});
