import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { teamEn as tm } from '../../i18n/coachTeam.en';
import { setViewport } from '../testViewport';
import { createFixturesTeamPort } from './__fixtures__/fixtures';
import { TeamScreen } from './TeamScreen';

afterEach(cleanup);
beforeEach(() => setViewport(1440));
const NOW = Date.UTC(2026, 9, 20, 9, 0);
const mount = (o = {}) =>
  render(<TeamScreen port={createFixturesTeamPort({ now: () => NOW, ...o })} />);

describe('Team screen', () => {
  it('trainer: members with roles, pending invite, add-a-team-member, only a manager row opens', async () => {
    mount();
    expect(await screen.findByText('Olena Kovalenko')).toBeTruthy();
    expect(screen.getByRole('button', { name: tm.tmAddMember })).toBeTruthy();
    expect(screen.getByText('kateryna@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: tm.tmOpenMember('Irina Melnyk') })).toBeTruthy();
    expect(screen.queryByRole('button', { name: tm.tmOpenMember('Andriy Petrenko') })).toBeNull();
  });

  it('manager: also adds a team member, cannot open a member, can leave', async () => {
    mount({ viewer: 'manager' });
    expect(await screen.findByRole('button', { name: tm.tmAddMember })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull();
    expect(screen.getByText(tm.tmLeave)).toBeTruthy();
  });

  it('add sheet: the type starts on the opposite role and the sender can switch it; the invite carries the chosen type', async () => {
    mount({ viewer: 'manager' });
    fireEvent.click(await screen.findByRole('button', { name: tm.tmAddMember }));
    const dlg = await screen.findByRole('dialog');
    expect(
      within(dlg).getByRole('button', { name: tm.tmRoleTrainer }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(within(dlg).getByRole('button', { name: tm.tmRoleManager }));
    expect(within(dlg).getByText(tm.tmAddManagerBody)).toBeTruthy();
    fireEvent.change(within(dlg).getByRole('textbox'), { target: { value: 'pick@example.com' } });
    fireEvent.click(within(dlg).getByRole('button', { name: tm.tmSendInvite }));
    fireEvent.click(await screen.findByRole('button', { name: tm.tmDone }));
    const row = (await screen.findByText('pick@example.com')).closest('li');
    expect(row?.textContent).toContain(tm.tmRoleManager);
  });

  it('add: bad e-mail shows the error; a good one hands over the link and copies it', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: tm.tmAddMember }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByRole('textbox'), { target: { value: 'bad' } });
    fireEvent.click(within(dlg).getByRole('button', { name: tm.tmSendInvite }));
    expect(await within(dlg).findByText(tm.tmErrInvalidEmail)).toBeTruthy();
    fireEvent.change(within(dlg).getByRole('textbox'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(within(dlg).getByRole('button', { name: tm.tmSendInvite }));
    const link = (await within(await screen.findByRole('dialog')).findByLabelText(
      tm.tmCopyLink,
    )) as HTMLInputElement;
    expect(link.value).toContain('#/team-invite/');
    fireEvent.click(screen.getByRole('button', { name: tm.tmDone }));
    await waitFor(() => expect(screen.getByText('new@example.com')).toBeTruthy());
  });

  it('remove a manager: confirm dialog first, then the member is gone', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: tm.tmOpenMember('Irina Melnyk') }));
    fireEvent.click(await screen.findByText(tm.tmRemoveFromTeam));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(tm.tmRemoveTitle('Irina'))).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: tm.tmRemoveConfirm }));
    await waitFor(() => expect(screen.queryByText('Irina Melnyk')).toBeNull());
  });

  it('loading is a skeleton, a failed first load offers Retry', async () => {
    mount({ cold: true, failWith: () => 'unavailable' });
    expect(await screen.findByText(tm.tmLoadFailed)).toBeTruthy();
    expect(screen.getByRole('button', { name: tm.tmRetry })).toBeTruthy();
  });

  it('phone: a pending invite opens a sheet with Copy link and Revoke instead of inline buttons', async () => {
    setViewport(390);
    mount();
    expect(await screen.findByText('kateryna@example.com')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: tm.tmRevokeFor('kateryna@example.com') }),
    ).toBeNull();
    fireEvent.click(screen.getByText('kateryna@example.com'));
    const sheet = await screen.findByRole('dialog');
    fireEvent.click(within(sheet).getByText(tm.tmRevokeFor('kateryna@example.com')));
    await waitFor(() => expect(screen.queryByText('kateryna@example.com')).toBeNull());
  });
});
