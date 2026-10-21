/**
 * SPO-200 / SPO-238 (UI): what the Team page shows and what its sheets and dialogs say, row by row against the AC.
 * Complements TeamScreen.test.tsx (flows) with the content of each part.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { teamEn as tm } from '../../i18n/coachTeam.en';
import { setViewport } from '../testViewport';
import { createFixturesTeamPort, type FixturesTeamOptions } from './__fixtures__/fixtures';
import { TeamScreen } from './TeamScreen';
import type { TeamPort } from './port';
import { lastActiveLabel } from './teamTime';

afterEach(cleanup);
beforeEach(() => setViewport(1440));
const NOW = Date.UTC(2026, 9, 20, 9, 0);

function mount(o: FixturesTeamOptions = {}, spy?: (p: TeamPort) => TeamPort) {
  const base = createFixturesTeamPort({ now: () => NOW, ...o });
  const port = spy ? spy(base) : base;
  const onNavigate = vi.fn();
  render(<TeamScreen port={port} onNavigate={onNavigate} />);
  return { onNavigate, port };
}
const members = () => within(screen.getByRole('list', { name: tm.tmMembersLabel }));

describe('Team page content (SPO-200 AC 1)', () => {
  it('a member row has avatar, name, role tag, "You" and last activity', async () => {
    mount();
    await screen.findByText('Olena Kovalenko');
    const me = members().getByText('Olena Kovalenko').closest('li')!;
    expect(me.textContent).toContain(tm.tmYou);
    expect(me.textContent).toContain(tm.tmRoleTrainer);
    expect(me.querySelector('.avatar')).toBeTruthy();
    const irina = members().getByText('Irina Melnyk').closest('li')!;
    expect(irina.textContent).toContain(tm.tmRoleManager);
    expect(irina.textContent).not.toContain(tm.tmYou);
    expect(irina.textContent).toContain(lastActiveLabel(tm, 'en', NOW, NOW - 40 * 60_000)!);
  });

  it('the side column links to Activity log, Spotter and "What each role can do"', async () => {
    const { onNavigate } = mount();
    fireEvent.click(await screen.findByText(tm.tmActivityLog));
    expect(onNavigate).toHaveBeenLastCalledWith({ screen: 'activity' });
    fireEvent.click(screen.getByText(tm.tmRoles));
    expect(onNavigate).toHaveBeenLastCalledWith({ screen: 'roles' });
    fireEvent.click(screen.getByText(tm.spOpenSpotter));
    expect(onNavigate).toHaveBeenLastCalledWith({ screen: 'spotter' });
  });

  it('desktop: a pending invite has Copy link and Revoke inline; Revoke removes it', async () => {
    mount();
    const row = (await screen.findByText('kateryna@example.com')).closest('li')!;
    expect(within(row).getByText(tm.tmPendingTag)).toBeTruthy();
    expect(within(row).getByRole('button', { name: tm.tmCopyLink })).toBeTruthy();
    fireEvent.click(
      within(row).getByRole('button', { name: tm.tmRevokeFor('kateryna@example.com') }),
    );
    await waitFor(() => expect(screen.queryByText('kateryna@example.com')).toBeNull());
  });

  it('no pending invites: no Pending section', async () => {
    mount({ viewer: 'trainer' }, (p) => ({
      ...p,
      peek: () => (p.peek() ? { ...p.peek()!, invites: [] } : null),
      load: async () => ({ ...(await p.load()), invites: [] }),
    }));
    await screen.findByText('Olena Kovalenko');
    expect(screen.queryByRole('list', { name: tm.tmPendingLabel })).toBeNull();
  });

  it('the trainer and the manager see "Add a team member" as the only add action (no role list on the page itself)', async () => {
    mount();
    expect(await screen.findAllByRole('button', { name: tm.tmAddMember })).toHaveLength(1);
  });
});

describe('Add errors (SPO-200 AC 3)', () => {
  it('a person already in the team or with an open invite: the exists error; the sheet stays open', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: tm.tmAddMember }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByRole('textbox'), {
      target: { value: 'kateryna@example.com' },
    });
    fireEvent.click(within(dlg).getByRole('button', { name: tm.tmSendInvite }));
    expect(await within(dlg).findByText(tm.tmErrExists)).toBeTruthy();
  });

  it('offline: the offline error; an e-mail with no account yet still gets an invite link', async () => {
    let off = false;
    mount({ failWith: () => (off ? 'offline' : null) });
    fireEvent.click(await screen.findByRole('button', { name: tm.tmAddMember }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByRole('textbox'), { target: { value: 'nobody@example.com' } });
    off = true;
    fireEvent.click(within(dlg).getByRole('button', { name: tm.tmSendInvite }));
    expect(await within(dlg).findByText(tm.tmErrOffline)).toBeTruthy();
    off = false;
    fireEvent.click(within(dlg).getByRole('button', { name: tm.tmSendInvite }));
    expect(await screen.findByLabelText(tm.tmCopyLink)).toBeTruthy();
  });
});

describe("Manager's card (SPO-200 AC 2, SPO-238)", () => {
  const open = async (o: FixturesTeamOptions = {}, spy?: (p: TeamPort) => TeamPort) => {
    const m = mount(o, spy);
    fireEvent.click(await screen.findByRole('button', { name: tm.tmOpenMember('Irina Melnyk') }));
    return { ...m, dlg: await screen.findByRole('dialog') };
  };

  it('shows Role, Email, Added, Last active, Schedule access (N of M ready), the switch and a danger Remove', async () => {
    const { dlg } = await open();
    for (const l of [
      tm.tmRole,
      tm.tmEmailRow,
      tm.tmAddedRow,
      tm.tmLastActiveRow,
      tm.tmScheduleAccess,
    ])
      expect(within(dlg).getByText(l)).toBeTruthy();
    expect(within(dlg).getByText('irina.m@example.com')).toBeTruthy();
    expect(within(dlg).getByText(tm.tmScheduleReady(9, 14))).toBeTruthy();
    expect(within(dlg).getByRole('switch', { name: tm.tmSeeAll })).toBeTruthy();
    expect(within(dlg).getByText(tm.tmRemoveFromTeam)).toBeTruthy();
  });

  it('"See all team activity" starts off, turning it on writes scope "all" for that manager, off writes "own"', async () => {
    const setScope = vi.fn();
    const { dlg } = await open({}, (p) => ({
      ...p,
      setActivityScope: (uid, scope) => {
        setScope(uid, scope);
        return p.setActivityScope(uid, scope);
      },
    }));
    const sw = within(dlg).getByRole('switch', { name: tm.tmSeeAll });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(within(dlg).getByText(tm.tmSeeAllOff('Irina'))).toBeTruthy();
    fireEvent.click(sw);
    await waitFor(() => expect(setScope).toHaveBeenLastCalledWith('manager-irina', 'all'));
    fireEvent.click(within(dlg).getByRole('switch', { name: tm.tmSeeAll }));
    await waitFor(() => expect(setScope).toHaveBeenLastCalledWith('manager-irina', 'own'));
  });

  it('a manager who already has full access shows the switch on', async () => {
    const { dlg } = await open({ managerScope: 'all' });
    expect(
      within(dlg).getByRole('switch', { name: tm.tmSeeAll }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('Remove from team: the dialog lists the three effects, Keep closes it without removing', async () => {
    const remove = vi.fn(async () => undefined);
    await open({}, (p) => ({ ...p, removeMember: remove }));
    fireEvent.click(screen.getByText(tm.tmRemoveFromTeam));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(tm.tmRemoveEffect1)).toBeTruthy();
    expect(within(confirm).getByText(tm.tmRemoveEffect2('Irina'))).toBeTruthy();
    expect(within(confirm).getByText(tm.tmRemoveEffect3)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: tm.tmRemoveKeep('Irina') }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });
});

describe('Leave team (SPO-200 AC 6)', () => {
  it('a manager: danger row, the dialog names the owner and lists the effects; confirming leaves', async () => {
    const leave = vi.fn(async () => undefined);
    mount({ viewer: 'manager' }, (p) => ({ ...p, leave }));
    fireEvent.click(await screen.findByText(tm.tmLeave));
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByText(tm.tmLeaveManagerTitle('Olena Kovalenko'))).toBeTruthy();
    for (const e of [tm.tmLeaveManagerEffect1, tm.tmLeaveManagerEffect2, tm.tmLeaveManagerEffect3])
      expect(within(dlg).getByText(e)).toBeTruthy();
    expect(leave).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole('button', { name: tm.tmLeaveConfirm }));
    await waitFor(() => expect(leave).toHaveBeenCalledTimes(1));
  });

  it('a trainer who is a member of another team: own title and effects; "Stay" does not leave', async () => {
    const leave = vi.fn(async () => undefined);
    mount({ notOwner: true }, (p) => ({ ...p, leave }));
    fireEvent.click(await screen.findByText(tm.tmLeave));
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByText(tm.tmLeaveTrainerTitle)).toBeTruthy();
    for (const e of [tm.tmLeaveTrainerEffect1, tm.tmLeaveTrainerEffect2, tm.tmLeaveTrainerEffect3])
      expect(within(dlg).getByText(e)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: tm.tmLeaveStay }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(leave).not.toHaveBeenCalled();
  });
});
