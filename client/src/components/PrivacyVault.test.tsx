import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Status = 'unknown' | 'unset' | 'locked' | 'ready';
const h = vi.hoisted(() => {
  const subs = new Set<() => void>();
  const v = {
    st: 'unset' as Status,
    status: () => v.st,
    subscribe: (f: () => void) => (subs.add(f), () => subs.delete(f)),
    set(s: Status) {
      v.st = s;
      subs.forEach((f) => f());
    },
    create: async () => {
      v.set('ready');
      return 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789';
    },
    unlock: async (k: string) => {
      const ok = k === 'good';
      if (ok) v.set('ready');
      return ok;
    },
    lock: async () => v.set('locked'),
  };
  return v;
});
vi.mock('../vaultIO', () => ({
  vault: h,
  migratePorts: () => ({ list: async () => [], write: async () => undefined }),
}));
vi.mock('../store', () => ({ workoutStats: () => ({ volumeKg: 0, sets: 0 }) }));
vi.mock('react-dom', async (orig) => ({
  ...(await orig<typeof import('react-dom')>()),
  createPortal: (n: unknown) => n,
}));

import { PrivacyVault } from './PrivacyVault';
import { setLocale } from '../i18n';

beforeEach(() => {
  setLocale('en');
  h.set('unset');
});
afterEach(cleanup);

describe('PrivacyVault', () => {
  it('offers to turn encryption on and shows the recovery key once', async () => {
    render(<PrivacyVault />);
    expect(screen.getByText('Encryption is off')).toBeTruthy();
    fireEvent.click(screen.getByText('Turn on encryption'));
    await waitFor(() => expect(screen.getByText('Save your recovery key')).toBeTruthy());
    expect((screen.getByLabelText('Recovery key') as HTMLInputElement).value).toMatch(/^ABCD-EFGH/);
    fireEvent.click(screen.getByText('I saved it'));
    await waitFor(() => expect(screen.queryByText('Save your recovery key')).toBeNull());
    expect(screen.getByText('Encrypted')).toBeTruthy();
  });

  it('a locked device asks for the key and reports a wrong one', async () => {
    h.set('locked');
    render(<PrivacyVault />);
    const unlock = screen.getByText('Unlock').closest('button')!;
    expect(unlock.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'nope' } });
    fireEvent.click(unlock);
    await waitFor(() => expect(screen.getByText('That key does not match.')).toBeTruthy());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'good' } });
    fireEvent.click(screen.getByText('Unlock').closest('button')!);
    await waitFor(() => expect(screen.getByText('Encrypted')).toBeTruthy());
  });

  it('ready state shows migration and can lock the device', async () => {
    h.set('ready');
    render(<PrivacyVault />);
    expect(screen.getByText('Encrypt now')).toBeTruthy();
    expect(screen.getByText('Your coach keeps access automatically.')).toBeTruthy();
    fireEvent.click(screen.getByText('Lock this device'));
    await waitFor(() => expect(screen.getByText('Locked on this device')).toBeTruthy());
  });
});
