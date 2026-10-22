import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const callFn = vi.fn();
vi.mock('../../api', () => ({ callFn: (...a: unknown[]) => callFn(...a) }));

import { TeamInviteSignInNotice } from './TeamInviteSignInNotice';

afterEach(() => {
  cleanup();
  callFn.mockReset();
});

describe('TeamInviteSignInNotice (SPO-284)', () => {
  it('asks the public preview with the token and names the inviter and the role', async () => {
    callFn.mockResolvedValue({ role: 'manager', invitedByName: 'Olena K.' });
    render(<TeamInviteSignInNotice token="tok1" />);
    await waitFor(() => expect(screen.getByText(/Olena K\./)).toBeTruthy());
    expect(callFn).toHaveBeenCalledWith('teamInvitePublic', { inviteId: 'tok1' });
    expect(screen.getByText(/as a manager/)).toBeTruthy();
    expect(screen.getByText(/No account yet/)).toBeTruthy();
  });

  it('a trainer invite says trainer account', async () => {
    callFn.mockResolvedValue({ role: 'trainer', invitedByName: 'Irina M.' });
    render(<TeamInviteSignInNotice token="tok2" />);
    await waitFor(() => expect(screen.getByText(/as a trainer/)).toBeTruthy());
  });

  it('a closed or unreachable link shows nothing; the Join page explains it after sign-in', async () => {
    callFn.mockRejectedValue(new Error('not-found'));
    const { container } = render(<TeamInviteSignInNotice token="dead" />);
    await waitFor(() => expect(callFn).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});
