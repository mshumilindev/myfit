import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

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
    createdAt: now,
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

  it('signs a device out and removes its row', async () => {
    render(<SessionsSheet onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(api.revokeSession).toHaveBeenCalledWith('phone-device-1'));
    await waitFor(() => expect(screen.queryByText('Safari · iOS')).toBeNull());
  });

  it('signs out all other devices', async () => {
    render(<SessionsSheet onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out all other devices' }));
    await waitFor(() => expect(api.revokeOtherSessions).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Safari · iOS')).toBeNull());
  });

  it('shows an error when the list cannot load', async () => {
    api.listSessions.mockRejectedValueOnce(new Error('x'));
    render(<SessionsSheet onClose={() => undefined} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
