import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const api = vi.hoisted(() => ({
  listSessions: vi.fn(),
  revokeSession: vi.fn(async () => undefined),
  revokeOtherSessions: vi.fn(async () => 1),
}));
vi.mock('../accounts/sessions', async (orig) => ({
  ...(await orig<typeof import('../accounts/sessions')>()),
  ...api,
  sessionDeviceId: () => 'this-device-id',
}));

import { SessionsSheet } from './SessionsSheet';

const now = Date.now();
const rows = [
  {
    deviceId: 'this-device-id',
    label: 'Chrome · macOS',
    city: 'warsaw',
    country: 'PL',
    lastSeenAt: now,
    createdAt: now,
  },
  {
    deviceId: 'phone-device-1',
    label: 'Safari · iOS',
    city: null,
    country: 'UA',
    lastSeenAt: now - 3_600_000,
    createdAt: now - 30 * 86_400_000,
  },
];

describe('SessionsSheet', () => {
  afterEach(cleanup);
  beforeEach(() => {
    api.listSessions.mockResolvedValue(rows);
    api.revokeSession.mockClear();
    api.revokeOtherSessions.mockClear();
  });

  it('lists the devices, marks this one and gives the others a sign-out', async () => {
    render(<SessionsSheet onClose={() => undefined} />);
    expect(await screen.findByText('Chrome · macOS')).toBeTruthy();
    expect(screen.getByText('This device')).toBeTruthy();
    expect(screen.getByText(/Warsaw, PL/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);
  });

  it('draws each device by its kind, guessing for records that have none yet', async () => {
    api.listSessions.mockResolvedValue([
      { ...rows[0], kind: 'tablet' },
      { ...rows[1], label: 'Safari · iOS' },
    ]);
    render(<SessionsSheet onClose={() => undefined} />);
    await screen.findByText('Chrome · macOS');
    const drawn = [...document.querySelectorAll('svg[data-device]')].map((e) =>
      e.getAttribute('data-device'),
    );
    expect(drawn).toEqual(['tablet', 'phone']);
  });

  it('calls out a sign-in on another device from the last day, not an old one', async () => {
    api.listSessions.mockResolvedValue([rows[0], { ...rows[1], createdAt: Date.now() - 60_000 }]);
    render(<SessionsSheet onClose={() => undefined} />);
    expect(await screen.findByText('New sign-in')).toBeTruthy();
    cleanup();
    api.listSessions.mockResolvedValue(rows);
    render(<SessionsSheet onClose={() => undefined} />);
    await screen.findByText('Chrome · macOS');
    expect(screen.queryByText('New sign-in')).toBeNull();
  });

  it('signs a device out and removes its row', async () => {
    render(<SessionsSheet onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(api.revokeSession).toHaveBeenCalledWith('phone-device-1'));
    await waitFor(() => expect(screen.queryByText('Safari · iOS')).toBeNull());
  });

  it('signs out all other devices', async () => {
    render(<SessionsSheet onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out all other devices' }));
    // a prompt first: nothing is signed out until it is confirmed
    expect(api.revokeOtherSessions).not.toHaveBeenCalled();
    const ask = document.querySelector('.uicfx') as HTMLElement;
    fireEvent.click(within(ask).getByRole('button', { name: 'Sign out all other devices' }));
    await waitFor(() => expect(api.revokeOtherSessions).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Safari · iOS')).toBeNull());
  });

  it('shows an error when the list cannot load', async () => {
    api.listSessions.mockRejectedValueOnce(new Error('x'));
    render(<SessionsSheet onClose={() => undefined} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('says an older entry is likely the same device as a newer one', async () => {
    const day = 86_400_000;
    api.listSessions.mockResolvedValue([
      rows[0],
      {
        deviceId: 'new-phone',
        label: 'Safari · iOS',
        kind: 'phone',
        city: null,
        country: 'UA',
        lastSeenAt: now - 60_000,
        createdAt: now - 2 * day,
      },
      {
        deviceId: 'old-phone',
        label: 'Safari · iOS',
        kind: 'phone',
        city: null,
        country: 'UA',
        lastSeenAt: now - 5 * day,
        createdAt: now - 9 * day,
      },
    ]);
    render(<SessionsSheet onClose={() => undefined} />);
    await screen.findByText('Chrome · macOS');
    expect(screen.getAllByText(/Likely the same device as a newer entry/)).toHaveLength(1);
  });
});
