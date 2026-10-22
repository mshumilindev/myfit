import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setLocale, fmtDayMonth } from '../i18n';
import { en } from '../i18n/en';
import { freezeClock, makeShell, NOW, emptyState, seed, setDesktop } from './__fixtures__/viewKit';
import { pm, profile } from './__fixtures__/profileKit';

vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  doc: (_d: unknown, c: string, id: string) => ({ c, id }),
  updateDoc: (...a: unknown[]) => pm.updateDoc(...a),
  setDoc: (...a: unknown[]) => pm.setDoc(...a),
  onSnapshot: () => () => undefined, // the nutrition store streams its meta docs
  collection: (_d: unknown, ...p: string[]) => ({ path: p.join('/') }),
}));
vi.mock('../nutrition/auth', () => ({
  onAuthChange: () => () => undefined,
  watchRole: () => () => undefined,
}));
vi.mock('firebase/storage', () => ({
  ref: (_s: unknown, p: string) => ({ p }),
  deleteObject: (...a: unknown[]) => pm.deleteObject(...a),
}));
vi.mock('../firebase', () => ({ db: {}, storage: {} }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  callFn: (...a: unknown[]) => pm.callFn(...a),
  renewSessionWithToken: (...a: unknown[]) => pm.renew(...a),
  currentUid: () => pm.uid,
  setUsername: (...a: unknown[]) => pm.setUsername(...a),
  trackMutation: <T,>(p: Promise<T>) => p,
}));
vi.mock('../profileFetch', () => ({ fetchProfile: pm.fetchProfile }));
vi.mock('../offline/offlineCache', () => ({
  offlinePeekNow: (k: string) => (k in pm.peek ? { at: 0, data: pm.peek[k] } : null),
  offlineHydrate: async (k: string, apply: (d: unknown) => void) => {
    if (k === 'adminPeople' && pm.hydrate) apply(pm.hydrate);
  },
  offlineLoad: (k: string, fetch: () => Promise<unknown>) => {
    pm.offlineLoad(k);
    return fetch();
  },
  offlineRemove: (...a: unknown[]) => pm.offlineRemove(...a),
  offlineSet: (...a: unknown[]) => pm.offlineSet(...a),
  offlineRevalidate: (o: {
    key: string;
    accept: (d: unknown) => boolean;
    fetch: () => Promise<unknown>;
    apply: (d: unknown, src: 'cache' | 'network') => void;
    onError: (e: unknown) => void;
  }) => {
    if (pm.revalMode === 'none') return () => undefined;
    if (pm.revalMode === 'cache' && o.key in pm.peek) o.apply(pm.peek[o.key], 'cache');
    o.fetch().then((d) => o.accept(d) && o.apply(d, 'network'), o.onError);
    return () => undefined;
  },
}));
vi.mock('../components/AvatarUploader', () => ({
  AvatarUploader: ({
    hasPhoto,
    onUploaded,
    onRemoved,
  }: {
    hasPhoto?: boolean;
    onUploaded: (u?: string) => void;
    onRemoved?: () => Promise<void> | void;
  }) => (
    <div data-testid="uploader" data-has={String(!!hasPhoto)}>
      <button onClick={() => onUploaded('blob:preview')}>stub upload</button>
      <button onClick={() => void onRemoved?.()}>stub remove</button>
    </div>
  ),
}));
vi.mock('../components/PrivacyVault', () => ({ PrivacyVault: () => <div data-testid="vault" /> }));
vi.mock('../components/BodyMetrics', () => ({
  BodyMetricsSection: (p: { readOnly: boolean; data?: unknown }) => (
    <div data-testid="body" data-readonly={String(p.readOnly)} data-has-data={String(!!p.data)} />
  ),
}));
vi.mock('./health/Conditions', () => ({
  ConditionsProfileRow: ({ onOpen }: { onOpen: () => void }) => (
    <button onClick={onOpen}>conditions row</button>
  ),
}));
vi.mock('./QuietHoursRows', () => ({ QuietHoursRows: () => <div data-testid="quiet" /> }));
vi.mock('../data/gymProviders', async (orig) => ({
  ...(await orig<typeof import('../data/gymProviders')>()),
  resolvePhoto: () => Promise.resolve(null),
}));

import { HttpError } from '../api';
import { ProfileView } from './ProfileView';

const open = (userId = 'me', embedded = false) => {
  const shell = makeShell();
  const onClose = vi.fn();
  const out = render(
    <ProfileView userId={userId} shell={shell} embedded={embedded} onClose={onClose} />,
  );
  return { ...out, shell, onClose };
};
const tab = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));
const loaded = () => screen.findByText(en.profTabOverview);

beforeEach(() => {
  freezeClock();
  setLocale('en');
  localStorage.clear();
  seed(emptyState());
  setDesktop(false);
  pm.uid = 'me';
  pm.peek = {};
  pm.hydrate = null;
  pm.revalMode = 'network';
  pm.fetchProfile.mockReset().mockImplementation(async (id: string) => pm.data[id] ?? profile());
  pm.callFn.mockReset().mockResolvedValue({});
  pm.renew.mockReset();
  pm.setUsername.mockReset();
  pm.updateDoc.mockReset().mockResolvedValue(undefined);
  pm.setDoc.mockReset().mockResolvedValue(undefined);
  pm.deleteObject.mockReset().mockResolvedValue(undefined);
  pm.offlineSet.mockReset().mockResolvedValue(undefined);
  pm.offlineRemove.mockReset().mockResolvedValue(undefined);
  pm.offlineLoad.mockReset();
  pm.data = { me: profile() };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ProfileView: loading and failure states', () => {
  it('shows the skeleton with the generic title until the profile arrives', async () => {
    pm.revalMode = 'none';
    const { container } = open();
    expect(container.querySelector('h2')?.textContent).toBe(en.profileTitle);
    expect(container.querySelector('.profile-hero')).toBeNull();
    expect(screen.queryByText(en.profTabOverview)).toBeNull();
  });

  it('paints a cached copy immediately, before the network answers', () => {
    pm.peek = { 'profile.me': profile() };
    pm.revalMode = 'none';
    const { container } = open();
    expect(container.querySelector('h2')?.textContent).toBe('Ada Lovelace');
  });

  it('a 403 says the profile is locked and drops the cached copy', async () => {
    pm.fetchProfile.mockRejectedValue(new HttpError(403, 'no'));
    open('other');
    expect(
      await screen.findByText(en.profileAccessDenied, {
        selector: '.uiempty *, [class*="empty"] *, h3, p, div',
      }),
    ).toBeTruthy();
    expect(screen.getByText(en.profileAccessDeniedBody)).toBeTruthy();
    expect(pm.offlineRemove).toHaveBeenCalledWith('profile.other');
  });

  it('a 404 says the profile does not exist', async () => {
    pm.fetchProfile.mockRejectedValue(new HttpError(404, 'gone'));
    open('ghost');
    expect(await screen.findByText(en.profileMissing, { selector: 'h2' })).toBeTruthy();
    expect(screen.getByText('GET /api/profile/users/ghost')).toBeTruthy();
  });

  it('any other failure shows a generic error', async () => {
    pm.fetchProfile.mockRejectedValue(new Error('boom'));
    open();
    expect(await screen.findByText(en.error)).toBeTruthy();
    expect(pm.offlineRemove).not.toHaveBeenCalled();
  });

  it('a failed refresh keeps the profile already on screen', async () => {
    pm.peek = { 'profile.me': profile() };
    pm.revalMode = 'cache';
    pm.fetchProfile.mockRejectedValue(new Error('offline'));
    const { container } = open();
    await act(async () => undefined);
    expect(container.querySelector('h2')?.textContent).toBe('Ada Lovelace');
    expect(screen.queryByText(en.error)).toBeNull();
  });

  it('the back button closes unless the page is embedded', () => {
    const a = open();
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(a.onClose).toHaveBeenCalled();
    cleanup();
    open('me', true);
    expect(screen.queryByRole('button', { name: en.backAction })).toBeNull();
  });
});

describe('ProfileView: own profile', () => {
  it('shows identity, join date, trainer, first and last session', async () => {
    pm.data.me = profile({}, { trainerName: 'Carl Coach', clientCount: 0 });
    const { container } = open();
    await loaded();
    const meta = container.querySelector('.profile-meta-grid')!.textContent!;
    expect(meta).toContain(`${en.profileJoined}: ${fmtDayMonth(NOW - 200 * 86_400_000, 'en')}`);
    expect(meta).toContain(`${en.profileStatus}: ${en.stActive}`);
    expect(meta).toContain(`${en.profileTrainer}: Carl Coach`);
    expect(meta).toContain(
      `${en.profileFirstSession}: ${fmtDayMonth(NOW - 190 * 86_400_000, 'en')}`,
    );
    expect(meta).toContain(`${en.profileLastSession}: ${fmtDayMonth(NOW - 2 * 86_400_000, 'en')}`);
    expect(meta).not.toContain(en.profileClientCount);
    expect(container.querySelector('.profile-name-line')?.textContent).toContain(en.profileSelf);
  });

  it('a person with no trainer and no sessions shows dashes and no session dates', async () => {
    pm.data.me = profile(
      { summary: { ...profile().summary, firstSessionAt: null, lastSessionAt: null } },
      { status: 'invited', clientCount: 4 },
    );
    const { container } = open();
    await loaded();
    const meta = container.querySelector('.profile-meta-grid')!.textContent!;
    expect(meta).toContain(`${en.profileTrainer}: —`);
    expect(meta).toContain(`${en.adminFilterPending}`);
    expect(meta).toContain(`${en.profileClientCount}: 4`);
    expect(meta).not.toContain(en.profileFirstSession);
    expect(meta).not.toContain(en.profileLastSession);
  });

  it('a suspended person is labelled suspended', async () => {
    pm.data.me = profile({}, { status: 'suspended' });
    const { container } = open();
    await loaded();
    expect(container.querySelector('.profile-meta-grid')!.textContent).toContain(en.stSuspended);
  });

  it('the overview shows the activity, load and structure numbers', async () => {
    const { container } = open();
    await loaded();
    const stats = Object.fromEntries(
      [...container.querySelectorAll('.profile-stat-cell')].map((c) => [
        c.querySelector('.l')!.textContent,
        c.querySelector('.v')!.textContent,
      ]),
    );
    expect(stats[en.adminSessions]).toBe('42');
    expect(stats[en.profileSessions30]).toBe('9');
    expect(stats[en.adminPerWeek]).toBe('2.1');
    expect(stats[en.profileLifetime]).toBe('123.4 t');
    expect(stats[en.adminVol30]).toBe('21.0 t');
    expect(stats[en.profileWeek]).toBe('4.5 t');
    expect(stats[en.setsStat]).toBe('640');
    expect(stats[en.exercises]).toBe('18');
    expect(stats[en.duration]).toBe('7:30');
    expect(stats[en.cardioMinutes]).toBe('95');
    expect(stats[en.profileLive]).toBeUndefined();
  });

  it('live sessions add an accented stat', async () => {
    pm.data.me = profile({ summary: { ...profile().summary, liveSessions: 2 } });
    const { container } = open();
    await loaded();
    const live = [...container.querySelectorAll('.profile-stat-cell.accent')];
    expect(live).toHaveLength(1);
    expect(live[0].textContent).toContain('2');
  });
});

describe('ProfileView: editing my details', () => {
  const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
  const save = () => screen.getByRole('button', { name: en.save }) as HTMLButtonElement;
  const cancel = () => screen.getAllByRole('button', { name: en.cancel })[0] as HTMLButtonElement;

  it('starts with the current names and nothing to save', async () => {
    open();
    await loaded();
    expect(field(en.firstName).value).toBe('Ada');
    expect(field(en.lastName).value).toBe('Lovelace');
    expect(field(en.username).value).toBe('ada');
    expect(save().disabled).toBe(true);
    expect(cancel().disabled).toBe(true);
  });

  it('Save needs a change and at least two characters in first name and username', async () => {
    open();
    await loaded();
    fireEvent.change(field(en.firstName), { target: { value: 'A' } });
    expect(save().disabled).toBe(true);
    fireEvent.change(field(en.firstName), { target: { value: 'Augusta' } });
    expect(save().disabled).toBe(false);
    fireEvent.change(field(en.username), { target: { value: ' ' } });
    expect(save().disabled).toBe(true);
  });

  it('Cancel puts the saved values back', async () => {
    open();
    await loaded();
    fireEvent.change(field(en.firstName), { target: { value: 'Augusta' } });
    fireEvent.click(cancel());
    expect(field(en.firstName).value).toBe('Ada');
    expect(save().disabled).toBe(true);
  });

  it('saving calls updateProfile, updates the stored name, the cache and shows a toast', async () => {
    const next = profile(
      {},
      { name: 'Augusta Byron', firstName: 'Augusta', lastName: 'Byron', username: 'augusta' },
    );
    pm.callFn.mockResolvedValue(next);
    const { shell } = open();
    await loaded();
    fireEvent.change(field(en.firstName), { target: { value: 'Augusta' } });
    fireEvent.change(field(en.lastName), { target: { value: 'Byron' } });
    fireEvent.change(field(en.username), { target: { value: 'augusta' } });
    fireEvent.click(save());
    await waitFor(() => expect(pm.setUsername).toHaveBeenCalledWith('Augusta Byron'));
    expect(pm.callFn).toHaveBeenCalledWith('updateProfile', {
      firstName: 'Augusta',
      lastName: 'Byron',
      username: 'augusta',
    });
    expect(pm.offlineSet).toHaveBeenCalledWith('profile.me', next);
    expect(shell.toast).toHaveBeenCalledWith({
      kind: 'ok',
      icon: 'check-circle',
      text: en.profileSaved,
    });
    expect(screen.getByText('Augusta Byron', { selector: '.profile-name-line span' })).toBeTruthy();
    expect(save().disabled).toBe(true);
  });

  it('a rejected save shows the server message and keeps the edits', async () => {
    pm.callFn.mockRejectedValue(new Error('Username taken'));
    const { shell } = open();
    await loaded();
    fireEvent.change(field(en.username), { target: { value: 'taken' } });
    fireEvent.click(save());
    expect(await screen.findByText('Username taken')).toBeTruthy();
    expect(field(en.username).value).toBe('taken');
    expect(shell.toast).not.toHaveBeenCalled();
    expect(save().disabled).toBe(false);
  });

  it('a non-Error rejection falls back to the generic error text', async () => {
    pm.callFn.mockRejectedValue('weird');
    open();
    await loaded();
    fireEvent.change(field(en.username), { target: { value: 'taken' } });
    fireEvent.click(save());
    expect(await screen.findByText(en.error, { selector: '.profile-error span' })).toBeTruthy();
  });

  it('embedded: Edit/Done toggles the editing state of the page', async () => {
    const { container } = open('me', true);
    await loaded();
    const page = container.querySelector('.profile-page')!;
    expect(page.classList.contains('profile-editing')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: en.edit }));
    expect(page.classList.contains('profile-editing')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: en.done }));
    expect(page.classList.contains('profile-editing')).toBe(false);
    expect(container.querySelector('.profile-mobile-meta')?.textContent).toBe(
      `@ada · ${en.roleMember.toLowerCase()}`,
    );
  });
});

describe('ProfileView: avatar', () => {
  it('uploading shows a toast and marks the photo present', async () => {
    const { shell } = open();
    await loaded();
    expect(screen.getByTestId('uploader').getAttribute('data-has')).toBe('false');
    fireEvent.click(screen.getByText('stub upload'));
    await waitFor(() =>
      expect(screen.getByTestId('uploader').getAttribute('data-has')).toBe('true'),
    );
    expect(shell.toast).toHaveBeenCalledWith({
      kind: 'ok',
      icon: 'check-circle',
      text: en.profileAvatarUpdated,
    });
    expect(pm.offlineSet).toHaveBeenCalledWith(
      'profile.me',
      expect.objectContaining({ person: expect.objectContaining({ avatar: true }) }),
    );
  });

  it('removing deletes the stored photo, clears the profile flag and says so', async () => {
    pm.data.me = profile({}, { avatar: true });
    const { shell } = open();
    await loaded();
    fireEvent.click(screen.getByText('stub remove'));
    await waitFor(() =>
      expect(shell.toast).toHaveBeenCalledWith({
        kind: 'ok',
        icon: 'check-circle',
        text: en.profileAvatarRemoved,
      }),
    );
    expect(pm.deleteObject).toHaveBeenCalledWith({ p: 'avatars/me/photo' });
    expect(pm.updateDoc).toHaveBeenCalledWith(
      { c: 'users', id: 'me' },
      expect.objectContaining({ avatarExt: null }),
    );
    expect(screen.getByTestId('uploader').getAttribute('data-has')).toBe('false');
  });

  it('removing still works when the stored file is already gone', async () => {
    pm.deleteObject.mockRejectedValue(new Error('not found'));
    const { shell } = open();
    await loaded();
    fireEvent.click(screen.getByText('stub remove'));
    await waitFor(() => expect(pm.updateDoc).toHaveBeenCalled());
    await waitFor(() => expect(shell.toast).toHaveBeenCalled());
  });

  it('without a signed-in user nothing is written but the page still updates', async () => {
    pm.uid = null;
    const { shell } = open();
    await loaded();
    fireEvent.click(screen.getByText('stub remove'));
    await waitFor(() => expect(shell.toast).toHaveBeenCalled());
    expect(pm.updateDoc).not.toHaveBeenCalled();
    expect(pm.deleteObject).not.toHaveBeenCalled();
  });
});

describe('ProfileView: password and sign out', () => {
  const settings = async () => {
    const out = open();
    await loaded();
    tab(en.profileSettings);
    return out;
  };
  const pw = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
  const submit = () =>
    screen.getByRole('button', { name: en.profilePasswordSave }) as HTMLButtonElement;
  const fill = (cur: string, nw: string, conf: string) => {
    fireEvent.change(pw(en.profilePasswordCurrent), { target: { value: cur } });
    fireEvent.change(pw(en.profilePasswordNew), { target: { value: nw } });
    fireEvent.change(pw(en.profilePasswordConfirm), { target: { value: conf } });
  };

  it('Update password needs the current one and 6+ characters twice', async () => {
    await settings();
    expect(submit().disabled).toBe(true);
    fill('old', '12345', '12345');
    expect(submit().disabled).toBe(true);
    fill('old', '123456', '12345');
    expect(submit().disabled).toBe(true);
    fill('', '123456', '123456');
    expect(submit().disabled).toBe(true);
    fill('old', '123456', '123456');
    expect(submit().disabled).toBe(false);
  });

  it('mismatching confirmation is rejected without calling the server', async () => {
    await settings();
    fill('old', '123456', '654321');
    fireEvent.click(submit());
    expect(await screen.findByText(en.profilePasswordMismatch)).toBeTruthy();
    expect(pm.callFn).not.toHaveBeenCalledWith('changePassword', expect.anything());
  });

  it('a change goes to the server, clears the fields and confirms', async () => {
    const { shell } = await settings();
    fill('old', '123456', '123456');
    fireEvent.click(submit());
    await waitFor(() =>
      expect(shell.toast).toHaveBeenCalledWith({
        kind: 'ok',
        icon: 'check-circle',
        text: en.profilePasswordSaved,
      }),
    );
    expect(pm.callFn).toHaveBeenCalledWith('changePassword', {
      currentPassword: 'old',
      newPassword: '123456',
    });
    expect(pw(en.profilePasswordNew).value).toBe('');
    expect(pw(en.profilePasswordCurrent).value).toBe('');
  });

  it('a change signs this device back in with the fresh token the server returns', async () => {
    pm.callFn.mockResolvedValue({ ok: true, token: 'fresh' });
    const { shell } = await settings();
    fill('old', '123456', '123456');
    fireEvent.click(submit());
    await waitFor(() => expect(shell.toast).toHaveBeenCalled());
    expect(pm.renew).toHaveBeenCalledWith('fresh');
  });

  it('a wrong current password shows the server message', async () => {
    pm.callFn.mockRejectedValue(new Error('Wrong password'));
    await settings();
    fill('bad', '123456', '123456');
    fireEvent.click(submit());
    expect(await screen.findByText('Wrong password')).toBeTruthy();
    expect(pw(en.profilePasswordNew).value).toBe('123456');
  });

  it('Cancel clears the fields and any error', async () => {
    await settings();
    fill('old', '123456', '654321');
    fireEvent.click(submit());
    await screen.findByText(en.profilePasswordMismatch);
    const buttons = screen.getAllByRole('button', { name: en.cancel });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(pw(en.profilePasswordNew).value).toBe('');
    expect(screen.queryByText(en.profilePasswordMismatch)).toBeNull();
  });

  it('the Password row opens the password editor state on the page', async () => {
    const { container } = await settings();
    fireEvent.click(screen.getByText(en.password));
    expect(
      container.querySelector('.profile-page')!.classList.contains('profile-password-editing'),
    ).toBe(true);
  });

  it('sign out asks first; confirming signs out, cancelling does not', async () => {
    const { shell } = await settings();
    fireEvent.click(screen.getByText(en.signOut));
    expect(screen.getByText(en.signOutTitle)).toBeTruthy();
    expect(screen.getByText(en.signOutCleanBody)).toBeTruthy();
    const ask = screen
      .getByText(en.signOutTitle)
      .closest('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    fireEvent.click(within(ask).getByRole('button', { name: en.cancel }));
    expect(shell.signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(en.signOut));
    const dlg = screen
      .getByText(en.signOutTitle)
      .closest('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    fireEvent.click(
      Array.from(dlg.querySelectorAll('button')).find((b) => b.textContent === en.signOut)!,
    );
    expect(shell.signOut).toHaveBeenCalledTimes(1);
  });

  it('with pending changes the sign-out text says how many', async () => {
    const shell = makeShell();
    (shell as unknown as { queueLength: number }).queueLength = 3;
    render(<ProfileView userId="me" shell={shell} onClose={vi.fn()} />);
    await loaded();
    tab(en.profileSettings);
    fireEvent.click(screen.getByText(en.signOut));
    expect(screen.getByText(en.signOutQueueBody(3))).toBeTruthy();
  });
});
