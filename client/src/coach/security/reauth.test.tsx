import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeEn as sf } from '../../i18n/coachSafe.en';
import { rosterEn as r } from '../../i18n/coachRoster.en';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { createLocalInvitePort, resetCreatedInvites } from '../data/inviteStore';
import { RosterScreen } from '../screens/RosterScreen';
import { Client360Screen } from '../screens/Client360Screen';
import { withInvites, worldPort } from '../screens/storyPorts';
import { setViewport } from '../testViewport';
import {
  configureReauth,
  createAuthReauthPort,
  forgetReauth,
  markReauthed,
  reauthFresh,
  REAUTH_FRESH_MS,
} from './reauth';
import { createFixturesReauthPort } from './__fixtures__/reauth';
import { useReauthGuard } from './useReauthGuard';

/** The field's label also holds the error text once there is one. */
const PW = new RegExp(sf.raPassword);

const api = vi.hoisted(() => ({
  callFn: vi.fn(),
  loginId: 'iryna' as string | null,
}));
vi.mock('../../api', async (orig) => ({
  ...(await orig<typeof import('../../api')>()),
  callFn: api.callFn,
  getLoginId: () => api.loginId,
  currentUid: () => 'u1',
}));

beforeEach(() => {
  setViewport(1440);
  forgetReauth();
  configureReauth(createFixturesReauthPort({ accept: 'secret' }));
  api.callFn.mockReset();
  api.loginId = 'iryna';
});
afterEach(() => {
  cleanup();
  configureReauth(null);
  resetCreatedInvites();
  vi.unstubAllEnvs();
});

describe('recency', () => {
  it('a confirmation covers five minutes, then it is asked again', () => {
    expect(reauthFresh(1_000)).toBe(false);
    markReauthed(1_000);
    expect(reauthFresh(1_000 + REAUTH_FRESH_MS - 1)).toBe(true);
    expect(reauthFresh(1_000 + REAUTH_FRESH_MS)).toBe(false);
  });
});

describe('the real port (login callable, same user only)', () => {
  it('ok only for the signed-in user; maps 401 / 429 / network', async () => {
    const port = createAuthReauthPort();
    api.callFn.mockResolvedValueOnce({ userId: 'u1' });
    expect(await port.check({ password: 'x' })).toBe('ok');
    expect(api.callFn).toHaveBeenCalledWith('login', { identifier: 'iryna', password: 'x' });
    api.callFn.mockResolvedValueOnce({ userId: 'someone-else' });
    expect(await port.check({ password: 'x' })).toBe('wrong');
    const { HttpError } = await import('../../api');
    api.callFn.mockRejectedValueOnce(new HttpError(401, 'no'));
    expect(await port.check({ password: 'x' })).toBe('wrong');
    api.callFn.mockRejectedValueOnce(new HttpError(429, 'slow down'));
    expect(await port.check({ password: 'x' })).toBe('locked');
    expect(await port.check({ password: '' })).toBe('wrong'); // never sends an empty password
  });
  it('asks for the identifier only when the app does not know it', async () => {
    api.loginId = null;
    const port = createAuthReauthPort();
    expect(port.knowsIdentifier()).toBe(false);
    expect(await port.check({ password: 'x' })).toBe('wrong');
    api.callFn.mockResolvedValueOnce({ userId: 'u1' });
    expect(await port.check({ password: 'x', identifier: ' Iryna ' })).toBe('ok');
    expect(api.callFn).toHaveBeenLastCalledWith('login', { identifier: 'Iryna', password: 'x' });
  });
});

describe('ReauthDialog + guard', () => {
  function Probe({ run }: { run: () => void }) {
    const { guard, dialog } = useReauthGuard();
    return (
      <>
        <button onClick={() => guard('export', run)}>go</button>
        {dialog}
      </>
    );
  }
  it('wrong password keeps the action blocked; the right one runs it, then it stays fresh', async () => {
    const run = vi.fn();
    render(<Probe run={run} />);
    fireEvent.click(screen.getByText('go'));
    const pw = screen.getByLabelText(PW);
    fireEvent.change(pw, { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: sf.raConfirm }));
    expect(await screen.findByText(sf.raWrong)).toBeTruthy();
    expect(run).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(PW), { target: { value: 'secret' } });
    fireEvent.keyDown(screen.getByLabelText(PW), { key: 'Enter' });
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    // fresh now: no prompt the second time
    fireEvent.click(screen.getByText('go'));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
  it('Cancel runs nothing', async () => {
    const run = vi.fn();
    render(<Probe run={run} />);
    fireEvent.click(screen.getByText('go'));
    fireEvent.click(screen.getByRole('button', { name: sf.raCancel }));
    await act(async () => undefined);
    expect(run).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('Roster: withdraw an invite', () => {
  const mount = () => {
    const invitePort = createLocalInvitePort();
    const revoke = vi.spyOn(invitePort, 'revoke');
    render(
      <RosterScreen
        onNavigate={() => undefined}
        port={worldPort(withInvites)}
        invitePort={invitePort}
        unreadByClient={{}}
      />,
    );
    return { revoke };
  };
  it('confirm, then the password, then the invite is revoked and leaves the list', async () => {
    const { revoke } = mount();
    const btns = await screen.findAllByRole('button', { name: /Withdraw invite for/ });
    const count = btns.length;
    fireEvent.click(btns[0]);
    fireEvent.click(screen.getByRole('button', { name: sf.invWithdrawConfirm }));
    expect(revoke).not.toHaveBeenCalled(); // the password comes first
    fireEvent.change(await screen.findByLabelText(PW), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: sf.raConfirm }));
    await waitFor(() => expect(revoke).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryAllByRole('button', { name: /Withdraw invite for/ })).toHaveLength(
        count - 1,
      ),
    );
  });
  it('a wrong password revokes nothing', async () => {
    const { revoke } = mount();
    fireEvent.click((await screen.findAllByRole('button', { name: /Withdraw invite for/ }))[0]);
    fireEvent.click(screen.getByRole('button', { name: sf.invWithdrawConfirm }));
    fireEvent.change(await screen.findByLabelText(PW), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: sf.raConfirm }));
    expect(await screen.findByText(sf.raWrong)).toBeTruthy();
    expect(revoke).not.toHaveBeenCalled();
  });
});

describe('Roster: resend an invite (one button: revoke + create)', () => {
  it('the password, then the old invite is revoked and a new one created; the new link is offered; a failure says so', async () => {
    const invitePort = createLocalInvitePort();
    const revoke = vi.spyOn(invitePort, 'revoke');
    const create = vi.spyOn(invitePort, 'create');
    render(
      <RosterScreen
        onNavigate={() => undefined}
        port={worldPort(withInvites)}
        invitePort={invitePort}
        unreadByClient={{}}
      />,
    );
    const btns = await screen.findAllByRole('button', { name: /Send a new invite to/ });
    fireEvent.click(btns[0]);
    expect(revoke).not.toHaveBeenCalled(); // the password comes first
    fireEvent.change(await screen.findByLabelText(PW), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: sf.raConfirm }));
    await waitFor(() => expect(revoke).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0].mode).toBeTruthy();
    expect(await screen.findByRole('button', { name: sf.invCopyLink })).toBeTruthy();
    cleanup();
    const bad = createLocalInvitePort({ fail: 'offline' });
    render(
      <RosterScreen
        onNavigate={() => undefined}
        port={worldPort(withInvites)}
        invitePort={bad}
        unreadByClient={{}}
      />,
    );
    // the password was just given: still fresh, no second prompt
    fireEvent.click((await screen.findAllByRole('button', { name: /Send a new invite to/ }))[0]);
    expect(await screen.findByText(sf.invResendFailed)).toBeTruthy();
  });
});

describe('Client 360: end coaching', () => {
  it('menu, who stops seeing what, the password, then the relationship ends', async () => {
    const port = createFixturesPort();
    const end = vi.spyOn(port, 'endCoaching' as never) as unknown as ReturnType<typeof vi.fn>;
    const onNavigate = vi.fn();
    render(<Client360Screen cid="c2" port={port} onNavigate={onNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: r.c3MenuLabel }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /End coaching with/ }));
    expect(screen.getByRole('alertdialog').textContent).toContain(sf.ecBody);
    fireEvent.click(screen.getByRole('button', { name: sf.ecConfirm }));
    expect(end).not.toHaveBeenCalled();
    fireEvent.change(await screen.findByLabelText(PW), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: sf.raConfirm }));
    await waitFor(() => expect(end).toHaveBeenCalledWith('c2'));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith({ screen: 'clients' }));
  });
});

describe('Coach shell has no idle lock', () => {
  it('never blurs, never asks for the password on its own, however long the page sits idle', async () => {
    // the removed lock was driven by this variable; it must now be inert
    vi.stubEnv('VITE_COACH_IDLE_MINUTES', '0.01'); // 0.6 s
    const { CoachShell } = await import('../CoachApp');
    render(
      <CoachShell
        role="trainer"
        name="Iryna Koval"
        route={{ screen: 'chat' }}
        onNavigate={() => undefined}
        onExitToWorkouts={() => undefined}
        onOpenShell={() => undefined}
      />,
    );
    const shell = document.querySelector('.co-shell') as HTMLElement;
    await act(async () => {
      await new Promise((res) => setTimeout(res, 1500));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(shell.hasAttribute('inert')).toBe(false);
    expect(shell.classList.contains('is-locked')).toBe(false);
    expect(screen.queryByText(/unlock|password/i)).toBeNull();
    vi.unstubAllEnvs();
  }, 10000);
});
