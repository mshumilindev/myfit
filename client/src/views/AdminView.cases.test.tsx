import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { DAY, freezeClock, NOW } from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({
  callFn: vi.fn(),
  mem: new Map<string, unknown>(),
  snapshot: { value: null as unknown },
  load: vi.fn(),
}));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  callFn: m.callFn,
  getUsername: () => 'Root Admin',
}));
vi.mock('../offline/offlineCache', () => ({
  offlinePeekNow: (key: string) => (m.mem.has(key) ? { at: 0, data: m.mem.get(key) } : null),
  offlineHydrate: async (
    _k: string,
    apply: (d: unknown) => void,
    o?: { accept?: (d: unknown) => boolean },
  ) => {
    if (m.snapshot.value && (!o?.accept || o.accept(m.snapshot.value))) apply(m.snapshot.value);
  },
  offlineLoad: (key: string, fetch: () => Promise<unknown>, o?: unknown) => {
    m.load(key, o);
    return fetch();
  },
}));

import { AdminView } from './AdminView';

type P = Record<string, unknown>;
const person = (over: P = {}): P => ({
  id: 'u',
  name: 'Person',
  username: 'person',
  firstName: 'Person',
  lastName: null,
  role: 'member',
  status: 'active',
  trainerId: null,
  trainerName: null,
  clientCount: 0,
  lastSessionAt: NOW - 2 * DAY,
  live: false,
  liveStartedAt: null,
  volume30: 18_000,
  avatar: false,
  invite: null,
  ...over,
});
const ME = person({ id: 'me', name: 'Root Admin', username: 'root', role: 'admin' });
const TRAINER = person({
  id: 't1',
  name: 'Tina Trainer',
  username: 'tina',
  role: 'trainer',
  clientCount: 4,
  volume30: 0,
});
const ADA = person({
  id: 'a',
  name: 'Ada Lovelace',
  username: 'ada',
  trainerId: 't1',
  trainerName: 'Tina Trainer',
});
const LIVE = person({
  id: 'l',
  name: 'Liv Live',
  username: 'liv',
  live: true,
  liveStartedAt: NOW - 61_000,
});
const DORMANT = person({
  id: 'd',
  name: 'Dan Dormant',
  username: 'dan',
  lastSessionAt: NOW - 45 * DAY,
});
const SUSP = person({ id: 's', name: 'Sue Suspended', username: 'sue', status: 'suspended' });
const INV = person({
  id: 'i',
  name: 'Ivy Invited',
  username: 'ivy',
  status: 'invited',
  lastSessionAt: null,
  volume30: 0,
  invite: {
    state: 'sent',
    expiresAt: NOW + 2.5 * DAY,
    claimedAt: null,
    reRequestedAt: NOW - DAY,
    token: 'tok-i',
  },
});
const EXP = person({
  id: 'x',
  name: 'Eve Expired',
  username: 'eve',
  status: 'invited',
  invite: {
    state: 'expired',
    expiresAt: NOW - DAY,
    claimedAt: null,
    reRequestedAt: null,
    token: 'tok-x',
  },
});
const REV = person({
  id: 'r',
  name: 'Rob Revoked',
  username: 'rob',
  status: 'invited',
  invite: {
    state: 'revoked',
    expiresAt: NOW + DAY,
    claimedAt: null,
    reRequestedAt: null,
    token: 'tok-r',
  },
});
const ALL = [ME, TRAINER, ADA, LIVE, DORMANT, SUSP, INV, EXP, REV];

let online = true;
beforeEach(() => {
  freezeClock();
  setLocale('en');
  m.callFn.mockReset();
  m.load.mockReset();
  m.mem.clear();
  m.snapshot.value = null;
  online = true;
  Object.defineProperty(navigator, 'onLine', { get: () => online, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function api(handlers: Record<string, (arg: unknown) => unknown> = {}, list: unknown = ALL) {
  m.callFn.mockImplementation(async (name: string, arg: unknown) => {
    if (name === 'adminPeople') {
      if (list instanceof Error) throw list;
      return { people: list };
    }
    const h = handlers[name];
    if (!h) throw new Error(`unexpected ${name}`);
    return h(arg);
  });
}
async function mount(list: unknown = ALL, handlers = {}) {
  api(handlers, list);
  const onOpenProfile = vi.fn();
  const out = render(<AdminView onOpenProfile={onOpenProfile} />);
  if (!(list instanceof Error))
    await screen.findByText(
      en.adminSummary(
        (list as P[]).filter((p) => p.role === 'member').length,
        (list as P[]).filter((p) => p.role === 'trainer' && p.status === 'active').length,
        (list as P[]).filter((p) => p.status === 'invited').length,
      ),
    );
  return { ...out, onOpenProfile };
}
const rowOf = (name: string): HTMLElement => {
  const r = [...document.querySelectorAll('.admin-row')].find(
    (x) => x.querySelector('.n')?.textContent === name,
  );
  if (!r) throw new Error(`no row ${name}`);
  return r as HTMLElement;
};
const openMenu = (name: string) =>
  fireEvent.click(within(rowOf(name)).getByRole('button', { name: en.menuAction }));

describe('AdminView: roster', () => {
  it('summarises members, trainers and pending invites; pins the signed-in admin; lists the others', async () => {
    const { container, onOpenProfile } = await mount();
    expect(screen.getByText(en.adminSummary(7, 1, 3))).toBeTruthy();
    const me = container.querySelector('.admin-me-card') as HTMLElement;
    expect(me.textContent).toContain('Root Admin');
    expect(me.textContent).toContain('@root');
    expect(me.textContent).toContain(en.roleAdmin);
    fireEvent.click(me);
    expect(onOpenProfile).toHaveBeenLastCalledWith('me');
    expect(container.querySelectorAll('.admin-row').length).toBe(ALL.length - 1);
    expect(screen.getByText(en.adminOnlyNote)).toBeTruthy();
  });

  it('shows each person role, trainer or client count, last seen, volume and status', async () => {
    await mount();
    const cells = (n: string) => [...rowOf(n).querySelectorAll('.meta')].map((c) => c.textContent);
    expect(cells('Tina Trainer')).toEqual([
      en.adminClients(4),
      'Sep 24',
      '—',
      expect.stringContaining(en.stActive),
    ]);
    expect(cells('Ada Lovelace')).toEqual([
      'Tina Trainer',
      'Sep 24',
      '18.0 t',
      expect.stringContaining(en.stActive),
    ]);
    expect(cells('Liv Live')[1]).toBe(en.stTrainingNow);
    expect(cells('Liv Live')[3]).toContain(`${en.stTrainingNow} · 1:01`);
    expect(cells('Dan Dormant')[3]).toContain(en.stDormant(45));
    expect(cells('Sue Suspended')[3]).toContain(en.stSuspended);
    expect(cells('Ivy Invited')[3]).toContain(en.stInviteSent(3));
    expect(cells('Eve Expired')[3]).toContain(en.stInviteExpired);
    expect(cells('Rob Revoked')[3]).toContain(en.stInviteRevoked);
    expect(cells('Ivy Invited')[1]).toBe(en.stNever);
    expect(rowOf('Tina Trainer').textContent).toContain(en.roleTrainer);
  });

  it('opens a profile by click or Enter/Space on the row', async () => {
    const { onOpenProfile } = await mount();
    fireEvent.click(rowOf('Ada Lovelace'));
    expect(onOpenProfile).toHaveBeenLastCalledWith('a');
    fireEvent.keyDown(rowOf('Liv Live'), { key: 'Enter' });
    expect(onOpenProfile).toHaveBeenLastCalledWith('l');
    fireEvent.keyDown(rowOf('Dan Dormant'), { key: ' ' });
    expect(onOpenProfile).toHaveBeenLastCalledWith('d');
    const calls = onOpenProfile.mock.calls.length;
    fireEvent.keyDown(rowOf('Dan Dormant'), { key: 'a' });
    expect(onOpenProfile.mock.calls.length).toBe(calls);
  });

  it('filters by role/pending and by search over name and username', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: en.adminFilterTrainers }));
    expect(document.querySelectorAll('.admin-row').length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: en.adminFilterPending }));
    expect(document.querySelectorAll('.admin-row').length).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: en.adminFilterMembers }));
    expect(document.querySelectorAll('.admin-row').length).toBe(
      ALL.filter((p) => p.role === 'member').length,
    );
    fireEvent.click(screen.getByRole('button', { name: en.adminFilterAll }));
    fireEvent.change(screen.getByPlaceholderText(en.adminSearch), { target: { value: 'ivy' } });
    expect(document.querySelectorAll('.admin-row').length).toBe(1);
    fireEvent.change(screen.getByPlaceholderText(en.adminSearch), {
      target: { value: 'lovelace' },
    });
    expect(rowOf('Ada Lovelace')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(en.adminSearch), { target: { value: 'nobody' } });
    expect(document.querySelectorAll('.admin-row').length).toBe(0);
  });

  it('with only yourself shows the empty state and no table', async () => {
    await mount([ME]);
    expect(screen.getByText(en.adminEmptyTitle)).toBeTruthy();
    expect(document.querySelector('.admin-table')).toBeNull();
    fireEvent.click(
      within(document.querySelector('.empty-state, [class*="empty"]') as HTMLElement).getByRole(
        'button',
        { name: new RegExp(en.adminNewMember) },
      ),
    );
    expect(screen.getByPlaceholderText(en.firstName)).toBeTruthy();
  });

  it('failed first load offers Retry', async () => {
    await mount(new Error('down'));
    expect(await screen.findByText(en.error)).toBeTruthy();
    api({}, ALL);
    fireEvent.click(screen.getByRole('button', { name: en.retry }));
    expect(await screen.findByText(en.adminSummary(7, 1, 3))).toBeTruthy();
    expect(m.load).toHaveBeenLastCalledWith('adminPeople', { force: true });
  });

  it('paints the session copy and the sealed snapshot without waiting for the network', async () => {
    m.mem.set('adminPeople', [ME, ADA]);
    m.callFn.mockReturnValue(new Promise(() => undefined));
    render(<AdminView onOpenProfile={() => undefined} />);
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    cleanup();
    m.mem.clear();
    m.snapshot.value = [ME, TRAINER];
    render(<AdminView onOpenProfile={() => undefined} />);
    expect((await screen.findAllByText('Tina Trainer')).length).toBeGreaterThan(0);
  });

  it('a failing background refresh keeps a loaded roster', async () => {
    await mount();
    m.callFn.mockRejectedValue(new Error('x'));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.queryByText(en.error)).toBeNull();
  });

  it('shows the offline banner while the browser is offline and clears it on return', async () => {
    await mount();
    expect(screen.queryByText(en.adminOffline)).toBeNull();
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(en.adminOffline)).toBeTruthy();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(en.adminOffline)).toBeNull();
  });

  it('polls every 15 s only while visible and refetches when the tab returns', async () => {
    vi.useFakeTimers({
      toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    });
    vi.setSystemTime(NOW);
    api();
    render(<AdminView onOpenProfile={() => undefined} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const n = () => m.callFn.mock.calls.filter((c) => c[0] === 'adminPeople').length;
    expect(n()).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(n()).toBe(2);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(n()).toBe(2);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(n()).toBe(3);
  });
});

describe('AdminView: row menu actions', () => {
  it('Open profile from the menu', async () => {
    const { onOpenProfile } = await mount();
    openMenu('Ada Lovelace');
    fireEvent.click(screen.getByText(en.adminOpenProfile));
    expect(onOpenProfile).toHaveBeenLastCalledWith('a');
  });

  it('active people get Send password reset; invited people get New link and Revoke instead', async () => {
    await mount();
    openMenu('Ada Lovelace');
    expect(screen.getByText(en.adminSendReset)).toBeTruthy();
    expect(screen.queryByText(en.adminRevoke)).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText(en.adminSendReset)).toBeNull());
    openMenu('Ivy Invited');
    expect(screen.queryByText(en.adminSendReset)).toBeNull();
    expect(screen.getByText(en.adminNewLink)).toBeTruthy();
    expect(screen.getByText(en.adminRevoke)).toBeTruthy();
  });

  it('password reset issues a link and shows it in the dialog', async () => {
    await mount(ALL, {
      adminResetPassword: () => ({ invite: { token: 'reset-1', expiresAt: NOW + 7 * DAY } }),
    });
    openMenu('Ada Lovelace');
    fireEvent.click(screen.getByText(en.adminSendReset));
    expect(await screen.findByText(en.adminReadyToClaim('Ada Lovelace'))).toBeTruthy();
    expect(m.callFn).toHaveBeenCalledWith('adminResetPassword', { id: 'a', locale: 'en' });
    expect(screen.getByText(/#\/join\/reset-1$/)).toBeTruthy();
    expect(screen.getByText('Tina Trainer', { selector: '.invite-cells .v' })).toBeTruthy();
  });

  it('New link re-issues the invite; Revoke cancels the one issued', async () => {
    await mount(ALL, {
      adminIssueInvite: () => ({ invite: { token: 'fresh', expiresAt: NOW + 7 * DAY } }),
      adminRevokeInvite: () => ({}),
    });
    openMenu('Ivy Invited');
    fireEvent.click(screen.getByText(en.adminNewLink));
    expect(await screen.findByText(en.adminReadyToClaim('Ivy Invited'))).toBeTruthy();
    expect(m.callFn).toHaveBeenCalledWith('adminIssueInvite', { id: 'i', locale: 'en' });
    expect(screen.getByText('No trainer', { selector: '.invite-cells .v' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.adminDone }));
    await waitFor(() => expect(screen.queryByText(en.adminReadyToClaim('Ivy Invited'))).toBeNull());
    openMenu('Ivy Invited');
    fireEvent.click(screen.getByText(en.adminRevoke));
    await waitFor(() =>
      expect(m.callFn).toHaveBeenCalledWith('adminRevokeInvite', { token: 'tok-i' }),
    );
  });

  it('Change email fixes the address of an unclaimed invitation and shows the new letter outcome', async () => {
    await mount(ALL, {
      adminChangeInviteEmail: () => ({
        invite: { token: 'moved', expiresAt: NOW + 7 * DAY },
        mail: { sent: true },
      }),
    });
    openMenu('Ivy Invited');
    fireEvent.click(screen.getByText(en.adminChangeEmail));
    const save = () => screen.getByRole('button', { name: en.save }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(en.adminInviteEmail), {
      target: { value: ' fixed@example.com ' },
    });
    fireEvent.click(save());
    expect(await screen.findByText(en.adminMailSent('fixed@example.com'))).toBeTruthy();
    expect(m.callFn).toHaveBeenCalledWith('adminChangeInviteEmail', {
      id: 'i',
      email: 'fixed@example.com',
      locale: 'en',
    });
  });

  it('the "asked for a new link" note offers Send without opening the profile', async () => {
    const { onOpenProfile } = await mount(ALL, {
      adminIssueInvite: () => ({ invite: { token: 'again', expiresAt: NOW + 7 * DAY } }),
    });
    const row = rowOf('Ivy Invited');
    expect(row.querySelector('.rerequest')?.textContent).toContain(en.adminAskedNewLink('Sep 25'));
    fireEvent.click(within(row).getByRole('button', { name: en.adminSend }));
    expect(await screen.findByText(en.adminReadyToClaim('Ivy Invited'))).toBeTruthy();
    expect(onOpenProfile).not.toHaveBeenCalled();
  });

  it('suspend flips the status at once; a suspended person gets Restore access', async () => {
    const live = ALL.map((p) => ({ ...p }));
    await mount(live, {
      adminSuspend: (a: unknown) => {
        live.find((p) => p.id === (a as { id: string }).id)!.status = 'suspended';
        return {};
      },
      adminUnsuspend: () => ({}),
    });
    openMenu('Ada Lovelace');
    fireEvent.click(screen.getByText(en.adminSuspend));
    await waitFor(() => expect(rowOf('Ada Lovelace').textContent).toContain(en.stSuspended));
    expect(m.callFn).toHaveBeenCalledWith('adminSuspend', { id: 'a' });
    openMenu('Sue Suspended');
    fireEvent.click(screen.getByText(en.adminUnsuspend));
    await waitFor(() => expect(m.callFn).toHaveBeenCalledWith('adminUnsuspend', { id: 's' }));
  });

  it('admin actions are refused while offline (nothing is queued)', async () => {
    await mount(ALL, { adminSuspend: () => ({}) });
    online = false;
    openMenu('Ada Lovelace');
    fireEvent.click(screen.getByText(en.adminSuspend));
    await Promise.resolve();
    expect(m.callFn.mock.calls.some((c) => c[0] === 'adminSuspend')).toBe(false);
  });

  it('a failed action shows its message in a banner and reloads the list', async () => {
    await mount(ALL, {
      adminSuspend: () => {
        throw new Error('Not allowed');
      },
    });
    openMenu('Ada Lovelace');
    fireEvent.click(screen.getByText(en.adminSuspend));
    expect(await screen.findByText('Not allowed')).toBeTruthy();
    expect(rowOf('Ada Lovelace').textContent).not.toContain(en.stSuspended);
  });

  it('export downloads a JSON file named after the person', async () => {
    await mount(ALL, { adminExportUser: () => ({ ok: 1 }) });
    const create = vi.fn(() => 'blob:export');
    Object.assign(URL, { createObjectURL: create });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('spotter-Ada Lovelace.json');
    });
    openMenu('Ada Lovelace');
    fireEvent.click(screen.getByText(en.adminExportData));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const blob = (create.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe('application/json');
    expect(JSON.parse(await blob.text())).toEqual({ ok: 1 });
    click.mockRestore();
  });
});

describe('AdminView: dialogs', () => {
  it('Change trainer lists the other trainers and admins (not the person) plus "No trainer", and assigns', async () => {
    await mount(ALL, { adminAssignTrainer: () => ({}) });
    openMenu('Ada Lovelace');
    fireEvent.click(screen.getByText(en.adminChangeTrainer));
    expect(screen.getByText(en.adminWhoTrains('Ada Lovelace'))).toBeTruthy();
    const list = document.querySelector('.assign-list') as HTMLElement;
    expect(within(list).getByText('Tina Trainer')).toBeTruthy();
    expect(within(list).getByText('Root Admin')).toBeTruthy();
    expect(within(list).queryByText('Ada Lovelace')).toBeNull();
    fireEvent.click(within(list).getByText('Root Admin'));
    fireEvent.click(screen.getByRole('button', { name: en.adminAssign }));
    await waitFor(() =>
      expect(m.callFn).toHaveBeenCalledWith('adminAssignTrainer', { id: 'a', trainerId: 'me' }),
    );
  });

  it('Change trainer can clear the trainer', async () => {
    await mount(ALL, { adminAssignTrainer: () => ({}) });
    openMenu('Ada Lovelace');
    fireEvent.click(screen.getByText(en.adminChangeTrainer));
    fireEvent.click(
      within(document.querySelector('.assign-list') as HTMLElement).getByText(en.adminNoTrainer),
    );
    fireEvent.click(screen.getByRole('button', { name: en.adminAssign }));
    await waitFor(() =>
      expect(m.callFn).toHaveBeenCalledWith('adminAssignTrainer', { id: 'a', trainerId: null }),
    );
  });

  it('Edit details trims, validates length and reports server errors', async () => {
    await mount(ALL, {
      adminEditUser: (a: unknown) => {
        if ((a as { username: string }).username === 'taken') throw new Error('Username taken');
        return {};
      },
    });
    openMenu('Ada Lovelace');
    fireEvent.click(screen.getByText(en.adminEditUserDetails));
    const username = screen.getByPlaceholderText(en.username) as HTMLInputElement;
    expect(username.value).toBe('ada');
    const save = () => screen.getByRole('button', { name: en.save }) as HTMLButtonElement;
    fireEvent.change(username, { target: { value: ' a ' } });
    expect(save().disabled).toBe(true);
    fireEvent.change(username, { target: { value: ' taken ' } });
    fireEvent.click(save());
    expect(await screen.findByText('Username taken')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(en.lastName), { target: { value: 'Byron ' } });
    fireEvent.change(username, { target: { value: ' adab ' } });
    fireEvent.click(save());
    await waitFor(() =>
      expect(m.callFn).toHaveBeenCalledWith('adminEditUser', {
        id: 'a',
        name: 'Person Byron',
        firstName: 'Person',
        lastName: 'Byron',
        username: 'adab',
      }),
    );
  });

  it('delete needs the exact name typed; success reloads, failure shows the message', async () => {
    await mount(ALL, { adminDeleteUser: () => ({}) });
    openMenu('Ada Lovelace');
    fireEvent.click(screen.getByText(en.adminDeleteMember));
    expect(screen.getByText(en.adminDeleteTitle('Ada Lovelace'))).toBeTruthy();
    const del = () => screen.getByRole('button', { name: en.delete }) as HTMLButtonElement;
    expect(del().disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(en.adminDeleteType('Ada Lovelace')), {
      target: { value: 'ada lovelace' },
    });
    expect(del().disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(en.adminDeleteType('Ada Lovelace')), {
      target: { value: 'Ada Lovelace' },
    });
    fireEvent.click(del());
    await waitFor(() => expect(m.callFn).toHaveBeenCalledWith('adminDeleteUser', { id: 'a' }));
    await waitFor(() => expect(screen.queryByText(en.adminDeleteTitle('Ada Lovelace'))).toBeNull());
  });

  it('a refused delete closes the dialog and shows the reason in the banner', async () => {
    await mount(ALL, {
      adminDeleteUser: () => {
        throw new Error('Cannot delete the last admin');
      },
    });
    openMenu('Ada Lovelace');
    fireEvent.click(screen.getByText(en.adminDeleteMember));
    fireEvent.change(screen.getByPlaceholderText(en.adminDeleteType('Ada Lovelace')), {
      target: { value: 'Ada Lovelace' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.delete }));
    expect(await screen.findByText('Cannot delete the last admin')).toBeTruthy();
    expect(screen.queryByText(en.adminDeleteTitle('Ada Lovelace'))).toBeNull();
  });

  it('Keep closes the delete dialog without calling the server', async () => {
    await mount();
    openMenu('Ada Lovelace');
    fireEvent.click(screen.getByText(en.adminDeleteMember));
    fireEvent.click(screen.getByRole('button', { name: en.keep }));
    expect(m.callFn.mock.calls.some((c) => c[0] === 'adminDeleteUser')).toBe(false);
  });

  it('New member: role choice, trainer choice, validation, creation and the invite dialog with QR and copy', async () => {
    const created = person({ id: 'new', name: 'Nina New', trainerName: 'Tina Trainer' });
    await mount(ALL, {
      adminCreateUser: () => ({
        person: created,
        invite: { token: 'inv-new', expiresAt: NOW + 7 * DAY },
        mail: { sent: true },
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.adminNewMember) }));
    const save = () => screen.getByRole('button', { name: en.save }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    // email is the one required field (names and username are optional at invitation time)
    const emailInput = screen.getByPlaceholderText(en.adminInviteEmail);
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    expect(save().disabled).toBe(true);
    fireEvent.change(emailInput, { target: { value: ' Nina@Example.com ' } });
    fireEvent.change(screen.getByPlaceholderText(en.firstName), { target: { value: ' Nina ' } });
    fireEvent.change(screen.getByPlaceholderText(en.lastName), { target: { value: ' New ' } });
    fireEvent.change(screen.getByPlaceholderText(en.username), { target: { value: ' nina ' } });
    fireEvent.click(screen.getByText(en.roleTrainer, { selector: '.admin-role-options *' }));
    const pick = document.querySelector('.assign-list') as HTMLElement;
    fireEvent.click(within(pick).getByText('Tina Trainer'));
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    expect(await screen.findByText(en.adminReadyToClaim('Nina New'))).toBeTruthy();
    expect(screen.getByText(en.adminMailSent('Nina@Example.com'))).toBeTruthy();
    expect(m.callFn).toHaveBeenCalledWith('adminCreateUser', {
      email: 'Nina@Example.com',
      locale: 'en',
      name: 'Nina New',
      firstName: 'Nina',
      lastName: 'New',
      username: 'nina',
      trainerId: 't1',
      role: 'trainer',
    });
    expect(screen.getByText(/\/#\/join\/inv-new$/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.adminQr) }));
    expect((document.querySelector('img.invite-qr') as HTMLImageElement).src).toContain(
      encodeURIComponent('/#/join/inv-new'),
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.adminQr) }));
    expect(document.querySelector('img.invite-qr')).toBeNull();
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.adminCopy) }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: new RegExp(en.adminCopied) })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole('button', { name: en.adminCreateAnother }));
    await waitFor(() => expect(screen.queryByText(en.adminReadyToClaim('Nina New'))).toBeNull());
  });

  it('a rejected create keeps the form and shows the message; non-Error falls back to Error', async () => {
    await mount(ALL, {
      adminCreateUser: () => {
        throw 'boom';
      },
    });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.adminNewMember) }));
    fireEvent.change(screen.getByPlaceholderText(en.adminInviteEmail), {
      target: { value: 'nina@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.save }));
    expect(await screen.findByText(en.error, { selector: '.field-error' })).toBeTruthy();
  });

  it('shows that the letter was not sent but keeps the link and QR available', async () => {
    await mount(ALL, {
      adminCreateUser: () => ({
        person: person({ id: 'n2', name: 'Pat' }),
        invite: { token: 'inv-2', expiresAt: NOW + 7 * DAY },
        mail: { sent: false, reason: 'not-configured' },
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.adminNewMember) }));
    fireEvent.change(screen.getByPlaceholderText(en.adminInviteEmail), {
      target: { value: 'pat@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.save }));
    expect(await screen.findByText(en.adminMailFailed)).toBeTruthy();
    expect(screen.getByText(/\/#\/join\/inv-2$/)).toBeTruthy();
  });

  it('with no trainers the new-member form has no trainer picker', async () => {
    await mount([ME, ADA]);
    // an admin is assignable as a trainer, so the picker lists them
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.adminNewMember) }));
    expect(
      within(document.querySelector('.assign-list') as HTMLElement).getByText('Root Admin'),
    ).toBeTruthy();
    expect(screen.getByText(en.adminNoTrainerNote)).toBeTruthy();
  });
});
