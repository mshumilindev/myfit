import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { freezeClock, makeShell, emptyState, seed, setDesktop } from './__fixtures__/viewKit';
import { pm, profile } from './__fixtures__/profileKit';

vi.mock('firebase/firestore', () => ({
  doc: (_d: unknown, c: string, id: string) => ({ c, id }),
  updateDoc: (...a: unknown[]) => pm.updateDoc(...a),
  setDoc: (...a: unknown[]) => pm.setDoc(...a),
}));
vi.mock('firebase/storage', () => ({
  ref: (_s: unknown, p: string) => ({ p }),
  deleteObject: (...a: unknown[]) => pm.deleteObject(...a),
}));
vi.mock('../firebase', () => ({ db: {}, storage: {} }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  callFn: (...a: unknown[]) => pm.callFn(...a),
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

const people = [
  {
    id: 'u7',
    name: 'Una User',
    username: 'una',
    role: 'member',
    status: 'active',
    trainerId: 't1',
    trainerName: 'Tina Trainer',
    clientCount: 0,
    avatar: false,
  },
  {
    id: 't1',
    name: 'Tina Trainer',
    username: 'tina',
    role: 'trainer',
    status: 'active',
    trainerId: null,
    trainerName: null,
    clientCount: 3,
    avatar: false,
  },
  {
    id: 't2',
    name: 'Sid Suspended',
    username: 'sid',
    role: 'trainer',
    status: 'suspended',
    trainerId: null,
    trainerName: null,
    clientCount: 0,
    avatar: false,
  },
  {
    id: 'a1',
    name: 'Boss Admin',
    username: 'boss',
    role: 'admin',
    status: 'active',
    trainerId: null,
    trainerName: null,
    clientCount: 0,
    avatar: false,
  },
  {
    id: 'm2',
    name: 'Mo Member',
    username: 'mo',
    role: 'member',
    status: 'active',
    trainerId: 'u7',
    trainerName: 'Una User',
    clientCount: 0,
    avatar: false,
  },
  {
    id: 'm3',
    name: 'Max Member',
    username: 'max',
    role: 'member',
    status: 'active',
    trainerId: null,
    trainerName: null,
    clientCount: 0,
    avatar: false,
  },
];
const asAdmin = (who: Record<string, unknown> = {}, over: Record<string, unknown> = {}) =>
  profile(
    over,
    {
      id: 'u7',
      name: 'Una User',
      firstName: 'Una',
      lastName: 'User',
      username: 'una',
      trainerId: 't1',
      trainerName: 'Tina Trainer',
      ...who,
    },
    { id: 'ad', relation: 'admin', role: 'admin' },
  );

const adminOpen = async (who: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => {
  pm.data.u7 = asAdmin(who, over);
  pm.callFn.mockImplementation(async (name: string) => (name === 'adminPeople' ? { people } : {}));
  const out = open('u7');
  await loaded();
  tab(en.profileSettings);
  return out;
};

describe('ProfileView: an admin viewing a member', () => {
  it('can edit their details and saves through adminEditUser, then reloads the profile', async () => {
    pm.data.u7 = asAdmin();
    const { shell } = open('u7');
    await loaded();
    const first = screen.getByLabelText(en.firstName) as HTMLInputElement;
    expect(first.value).toBe('Una');
    fireEvent.change(first, { target: { value: 'Unity' } });
    pm.data.u7 = asAdmin({ firstName: 'Unity', name: 'Unity User' });
    fireEvent.click(screen.getByRole('button', { name: en.save }));
    await waitFor(() =>
      expect(shell.toast).toHaveBeenCalledWith({
        kind: 'ok',
        icon: 'check-circle',
        text: en.profileSaved,
      }),
    );
    expect(pm.callFn).toHaveBeenCalledWith('adminEditUser', {
      id: 'u7',
      firstName: 'Unity',
      lastName: 'User',
      username: 'una',
    });
    expect(pm.setUsername).not.toHaveBeenCalled();
    expect(screen.getByText('Unity User', { selector: '.profile-name-line span' })).toBeTruthy();
  });

  it('sees no avatar uploader, and the tag shows the person role', async () => {
    pm.data.u7 = asAdmin({ role: 'trainer' });
    const { container } = open('u7');
    await loaded();
    expect(screen.queryByTestId('uploader')).toBeNull();
    expect(container.querySelector('.profile-name-line')?.textContent).toContain(en.roleTrainer);
  });

  it('the settings tab shows who sees the data, not the owner-only settings', async () => {
    await adminOpen();
    expect(screen.getByText(en.profWhoSees)).toBeTruthy();
    expect(screen.queryByText(en.signOut)).toBeNull();
    expect(screen.queryByTestId('vault')).toBeNull();
    expect(document.querySelector('.profile-audit-section')).toBeNull();
  });

  it('shows the assigned trainer, or "no trainer", and the trainer privileges switch', async () => {
    await adminOpen();
    expect(
      screen.getByText(en.profileAssignTrainerAction).closest('button, [role="button"], div')!
        .textContent,
    ).toContain('Tina Trainer');
    const sw = screen.getByRole('switch', { name: en.profileTrainerPriv }) as HTMLInputElement;
    expect(sw.checked).toBe(false);
    expect(screen.queryByText(en.profileAssignClientsAction)).toBeNull();
    cleanup();
    await adminOpen({ trainerId: null, trainerName: null });
    expect(screen.getByText(en.adminNoTrainer)).toBeTruthy();
  });

  it('no privileges switch when looking at an admin or at myself', async () => {
    await adminOpen({ role: 'admin' });
    expect(screen.queryByRole('switch', { name: en.profileTrainerPriv })).toBeNull();
    cleanup();
    pm.data.u7 = profile(
      {},
      { id: 'ad', name: 'Boss' },
      { id: 'ad', relation: 'self', role: 'admin' },
    );
    open('u7');
    await loaded();
    tab(en.profileSettings);
    expect(screen.queryByRole('switch', { name: en.profileTrainerPriv })).toBeNull();
    expect(screen.getByText(en.profileAssignTrainerAction)).toBeTruthy();
  });

  it('turning trainer privileges on calls adminChangeRole, reloads and confirms', async () => {
    const { shell } = await adminOpen();
    pm.data.u7 = asAdmin({ role: 'trainer' });
    fireEvent.click(screen.getByRole('switch', { name: en.profileTrainerPriv }));
    await waitFor(() =>
      expect(shell.toast).toHaveBeenCalledWith({
        kind: 'ok',
        icon: 'check-circle',
        text: en.profileSaved,
      }),
    );
    expect(pm.callFn).toHaveBeenCalledWith('adminChangeRole', { id: 'u7', role: 'trainer' });
    expect(
      (screen.getByRole('switch', { name: en.profileTrainerPriv }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(screen.getByText(en.profileAssignClientsAction)).toBeTruthy();
  });

  it('turning it off sends member; a refusal shows a danger toast with the reason', async () => {
    const { shell } = await adminOpen({ role: 'trainer' });
    pm.callFn.mockImplementation(async (name: string) => {
      if (name === 'adminChangeRole') throw new Error('Last trainer');
      return { people };
    });
    fireEvent.click(screen.getByRole('switch', { name: en.profileTrainerPriv }));
    await waitFor(() =>
      expect(shell.toast).toHaveBeenCalledWith({
        kind: 'danger',
        icon: 'warning-circle',
        text: 'Last trainer',
      }),
    );
    expect(pm.callFn).toHaveBeenCalledWith('adminChangeRole', { id: 'u7', role: 'member' });
  });
});

describe('ProfileView: assigning a trainer', () => {
  const openSheet = async (who: Record<string, unknown> = {}) => {
    const out = await adminOpen(who);
    fireEvent.click(screen.getByText(en.profileAssignTrainerAction));
    await screen.findByText(en.adminWhoTrains('Una User'));
    return out;
  };

  it('lists active trainers and admins (not the person, not suspended), with their client counts', async () => {
    await openSheet();
    const names = [...document.querySelectorAll('.assign-list > *')].map(
      (r) => r.textContent ?? '',
    );
    expect(names.some((n) => n.includes('Tina Trainer') && n.includes(en.adminClients(3)))).toBe(
      true,
    );
    expect(names.some((n) => n.includes('Boss Admin'))).toBe(true);
    expect(names.some((n) => n.includes('Sid Suspended'))).toBe(false);
    expect(names.some((n) => n.includes('Mo Member'))).toBe(false);
    expect(names.some((n) => n.includes(en.adminNoTrainer))).toBe(true);
    expect(pm.offlineLoad).toHaveBeenCalledWith('adminPeople');
  });

  it('uses the sealed roster snapshot without asking the server', async () => {
    pm.hydrate = people;
    pm.data.u7 = asAdmin();
    open('u7');
    await loaded();
    tab(en.profileSettings);
    await waitFor(() => expect(screen.getByText(en.profileAssignTrainerAction)).toBeTruthy());
    fireEvent.click(screen.getByText(en.profileAssignTrainerAction));
    await screen.findByText(en.adminWhoTrains('Una User'));
    expect(pm.callFn).not.toHaveBeenCalledWith('adminPeople');
  });

  it('choosing another trainer assigns, drops the roster cache, reloads and toasts', async () => {
    const { shell } = await openSheet();
    fireEvent.click(screen.getByText('Boss Admin'));
    pm.data.u7 = asAdmin({ trainerId: 'a1', trainerName: 'Boss Admin' });
    fireEvent.click(screen.getByRole('button', { name: en.adminAssign }));
    await waitFor(() =>
      expect(shell.toast).toHaveBeenCalledWith({
        kind: 'ok',
        icon: 'check-circle',
        text: en.profileSaved,
      }),
    );
    expect(pm.callFn).toHaveBeenCalledWith('adminAssignTrainer', { id: 'u7', trainerId: 'a1' });
    expect(pm.offlineRemove).toHaveBeenCalledWith('adminPeople');
    expect(screen.queryByText(en.adminWhoTrains('Una User'))).toBeNull();
    expect(
      screen.getByText(en.profileAssignTrainerAction).closest('div')!.parentElement!.textContent,
    ).toContain('Boss Admin');
  });

  it('"No trainer" clears the assignment', async () => {
    await openSheet();
    fireEvent.click(screen.getByText(en.adminNoTrainer, { selector: '.assign-list *' }));
    fireEvent.click(screen.getByRole('button', { name: en.adminAssign }));
    await waitFor(() =>
      expect(pm.callFn).toHaveBeenCalledWith('adminAssignTrainer', { id: 'u7', trainerId: null }),
    );
  });

  it('a server refusal is shown in the sheet and the sheet stays open', async () => {
    const { shell } = await openSheet();
    pm.callFn.mockImplementation(async (name: string) => {
      if (name === 'adminAssignTrainer') throw new Error('Trainer is full');
      return { people };
    });
    fireEvent.click(screen.getByRole('button', { name: en.adminAssign }));
    expect(await screen.findByText('Trainer is full')).toBeTruthy();
    expect(screen.getByText(en.adminWhoTrains('Una User'))).toBeTruthy();
    expect(shell.toast).not.toHaveBeenCalled();
    expect(
      (screen.getByRole('button', { name: en.adminAssign }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('Cancel closes without calling the server', async () => {
    await openSheet();
    fireEvent.click(document.querySelector('.sheet-actions button') as HTMLElement);
    await waitFor(() => expect(screen.queryByText(en.adminWhoTrains('Una User'))).toBeNull());
    expect(pm.callFn).not.toHaveBeenCalledWith('adminAssignTrainer', expect.anything());
  });

  it('when the roster cannot be loaded the admin sees why and no sheet opens', async () => {
    pm.data.u7 = asAdmin();
    pm.callFn.mockRejectedValue(new Error('Roster offline'));
    const { shell } = open('u7');
    await loaded();
    tab(en.profileSettings);
    fireEvent.click(screen.getByText(en.profileAssignTrainerAction));
    await waitFor(() =>
      expect(shell.toast).toHaveBeenCalledWith({
        kind: 'danger',
        icon: 'warning-circle',
        text: 'Roster offline',
      }),
    );
    expect(screen.queryByText(en.adminWhoTrains('Una User'))).toBeNull();
  });
});

describe('ProfileView: assigning clients to a trainer', () => {
  const openSheet = async () => {
    const out = await adminOpen({ role: 'trainer', clientCount: 1 });
    fireEvent.click(screen.getByText(en.profileAssignClientsAction));
    await screen.findByText(en.profileAssignClientsTitle('Una User'));
    return out;
  };

  it('shows the client count and everyone else, with current clients switched on', async () => {
    await adminOpen({ role: 'trainer', clientCount: 1 });
    expect(screen.getByText(en.adminClients(1))).toBeTruthy();
    fireEvent.click(screen.getByText(en.profileAssignClientsAction));
    await screen.findByText(en.profileAssignClientsHint);
    const rows = [...document.querySelectorAll('.assign-list > *')];
    // the person themself is not a candidate: 'Una User' only appears as Mo's trainer name
    expect(rows).toHaveLength(people.length - 1);
    expect(rows.filter((r) => r.textContent?.includes('Una User'))).toHaveLength(1);
    const mo = rows.find((r) => r.textContent?.includes('Mo Member'))!;
    const max = rows.find((r) => r.textContent?.includes('Max Member'))!;
    expect(mo.className).toContain('selected');
    expect(max.className).not.toContain('selected');
  });

  it('saves only the differences: adds Max, removes Mo', async () => {
    const { shell } = await openSheet();
    const row = (n: string) =>
      [...document.querySelectorAll('.assign-list > *')].find((r) =>
        r.textContent?.includes(n),
      ) as HTMLElement;
    fireEvent.click(row('Max Member'));
    fireEvent.click(row('Mo Member'));
    pm.data.u7 = asAdmin({ role: 'trainer', clientCount: 1 });
    fireEvent.click(screen.getByRole('button', { name: en.adminAssign }));
    await waitFor(() =>
      expect(shell.toast).toHaveBeenCalledWith({
        kind: 'ok',
        icon: 'check-circle',
        text: en.profileSaved,
      }),
    );
    const assigns = pm.callFn.mock.calls
      .filter((c) => c[0] === 'adminAssignTrainer')
      .map((c) => c[1]);
    expect(assigns).toEqual([
      { id: 'm2', trainerId: null },
      { id: 'm3', trainerId: 'u7' },
    ]);
    expect(pm.offlineRemove).toHaveBeenCalledWith('adminPeople');
  });

  it('saving without changes makes no assignment calls', async () => {
    await openSheet();
    fireEvent.click(screen.getByRole('button', { name: en.adminAssign }));
    await waitFor(() => expect(pm.offlineRemove).toHaveBeenCalledWith('adminPeople'));
    expect(pm.callFn.mock.calls.filter((c) => c[0] === 'adminAssignTrainer')).toHaveLength(0);
  });

  it('a failure part-way is shown and the sheet stays open', async () => {
    await openSheet();
    pm.callFn.mockImplementation(async (name: string) => {
      if (name === 'adminAssignTrainer') throw new Error('Quota reached');
      return { people };
    });
    const max = [...document.querySelectorAll('.assign-list > *')].find((r) =>
      r.textContent?.includes('Max Member'),
    ) as HTMLElement;
    fireEvent.click(max);
    fireEvent.click(screen.getByRole('button', { name: en.adminAssign }));
    expect(await screen.findByText('Quota reached')).toBeTruthy();
    expect(screen.getByText(en.profileAssignClientsTitle('Una User'))).toBeTruthy();
  });

  it('Cancel closes the sheet', async () => {
    await openSheet();
    fireEvent.click(document.querySelector('.sheet-actions button') as HTMLElement);
    await waitFor(() =>
      expect(screen.queryByText(en.profileAssignClientsTitle('Una User'))).toBeNull(),
    );
  });
});
