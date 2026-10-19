import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import {
  DAY,
  freezeClock,
  makeShell,
  NOW,
  emptyState,
  seed,
  setDesktop,
} from './__fixtures__/viewKit';
import { __getStateForTests } from '../store';
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

const asTrainerView = (over: Record<string, unknown> = {}) =>
  profile(
    over,
    { id: 'c1', name: 'Cleo Client', role: 'member' },
    { id: 'tr', relation: 'trainer', role: 'trainer' },
  );
describe('ProfileView: a trainer looking at a client', () => {
  it('sees a read-only page: no edit fields, a plain @username and the role tag', async () => {
    pm.data.c1 = asTrainerView();
    const { container } = open('c1');
    await loaded();
    expect(container.querySelector('.profile-detail-fields')).toBeNull();
    expect(container.querySelector('.detail-muted')?.textContent).toBe('@ada');
    expect(container.querySelector('.profile-name-line')?.textContent).toContain(en.roleMember);
    expect(screen.queryByTestId('uploader')).toBeNull();
  });

  it('a client training right now shows a live tag and the live panel with the first exercise', async () => {
    pm.data.c1 = asTrainerView({
      summary: { ...profile().summary, liveSessions: 1 },
      sessions: [
        {
          id: 'live1',
          startedAt: NOW - 600_000,
          finishedAt: null,
          autoFinished: false,
          live: true,
          durationMs: null,
          gymName: 'Iron Yard',
          sets: 7,
          exercises: 2,
          volumeKg: 2_400,
          exerciseNames: ['Bench Press'],
        },
      ],
    });
    const { container } = open('c1');
    await loaded();
    expect(container.querySelector('.profile-name-line')?.textContent).toContain(en.stTrainingNow);
    const panel = container.querySelector('.tr-live-panel')!;
    expect(panel.textContent).toContain(en.trLiveNow);
    expect(panel.querySelector('.tr-live-head')?.textContent).toContain('Bench Press');
    expect(panel.querySelector('.tr-live-head')?.textContent).toContain('7 · 2.4 t');
    expect(panel.textContent).toContain(en.trLiveReadOnly);
  });

  it('a live session without exercises is titled "Training now"; no live session means no panel', async () => {
    pm.data.c1 = asTrainerView({
      sessions: [
        {
          id: 'l',
          startedAt: NOW,
          finishedAt: null,
          autoFinished: false,
          live: true,
          durationMs: null,
          gymName: null,
          sets: 0,
          exercises: 0,
          volumeKg: 0,
          exerciseNames: [],
        },
      ],
    });
    const { container } = open('c1');
    await loaded();
    expect(container.querySelector('.tr-live-head span')?.textContent).toBe(en.stTrainingNow);
    cleanup();
    pm.data.c1 = asTrainerView();
    const b = open('c1');
    await loaded();
    expect(b.container.querySelector('.tr-live-panel')).toBeNull();
  });

  it('opening a session routes to the trainee view, passing the athlete; a live row does nothing', async () => {
    pm.data.c1 = asTrainerView({
      sessions: [
        {
          id: 'done1',
          startedAt: NOW - DAY,
          finishedAt: NOW - DAY + 1000,
          autoFinished: false,
          live: false,
          durationMs: 1000,
          gymName: 'G',
          sets: 1,
          exercises: 1,
          volumeKg: 10,
          exerciseNames: ['Row'],
        },
        {
          id: 'live1',
          startedAt: NOW,
          finishedAt: null,
          autoFinished: false,
          live: true,
          durationMs: null,
          gymName: 'G',
          sets: 1,
          exercises: 1,
          volumeKg: 10,
          exerciseNames: ['Curl'],
        },
      ],
    });
    const { shell, container } = open('c1');
    await loaded();
    const rows = container.querySelectorAll('.profile-sessions > *');
    fireEvent.click(rows[0]);
    expect(shell.openOverlay).toHaveBeenCalledWith({
      screen: 'trainee-session',
      athleteId: 'c1',
      workoutId: 'done1',
      athleteName: 'Cleo Client',
    });
    (shell.openOverlay as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(rows[1]);
    expect(shell.openOverlay).not.toHaveBeenCalled();
  });

  it("a top exercise opens that client's history", async () => {
    pm.data.c1 = asTrainerView();
    const { shell } = open('c1');
    await loaded();
    fireEvent.click(screen.getByText('Barbell Squat'));
    expect(shell.openOverlay).toHaveBeenCalledWith({
      screen: 'exercise-history',
      name: 'Barbell Squat',
      userId: 'c1',
      userName: 'Cleo Client',
    });
  });

  it('has no who-sees-this or settings blocks, but can read the body tab when the client shares it', async () => {
    pm.data.c1 = asTrainerView({ bodyMetrics: { weights: [] } });
    open('c1');
    await loaded();
    tab(en.profileSettings);
    expect(screen.queryByText(en.profWhoSees)).toBeNull();
    expect(screen.queryByText(en.signOut)).toBeNull();
    tab(en.profTabBody);
    const body = screen.getByTestId('body');
    expect(body.getAttribute('data-readonly')).toBe('true');
    expect(body.getAttribute('data-has-data')).toBe('true');
  });

  it('with no shared body data the body tab is empty', async () => {
    pm.data.c1 = asTrainerView({ bodyMetrics: null });
    open('c1');
    await loaded();
    tab(en.profTabBody);
    expect(screen.queryByTestId('body')).toBeNull();
  });
});

describe('ProfileView: overview lists', () => {
  it('lists top exercises with e1RM only when there is one, and opens their history', async () => {
    const { shell, container } = open();
    await loaded();
    const rows = [...container.querySelectorAll('.profile-columns .profile-list > *')];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('40.0 t');
    expect(rows[0].textContent).toContain('153 kg e1RM');
    expect(rows[0].textContent).toContain(`20 · 100 ${en.sets}`);
    expect(rows[1].textContent).not.toContain('e1RM');
    fireEvent.click(rows[0]);
    expect(shell.openOverlay).toHaveBeenCalledWith({
      screen: 'exercise-history',
      name: 'Barbell Squat',
    });
  });

  it('empty training data and gyms say so', async () => {
    pm.data.me = profile({ topExercises: [], gyms: [], sessions: [] });
    open();
    await loaded();
    expect(screen.getAllByText(en.profileNoTraining)).toHaveLength(2);
    expect(screen.getByText(en.profileNoGyms)).toBeTruthy();
  });

  it('gyms show visits, volume and last visit ("never" when none), main tag and coordinates; clicking opens the gym', async () => {
    const { shell, container } = open();
    await loaded();
    const cards = container.querySelectorAll('.profile-gym-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain(en.pickGymFavourite);
    expect(cards[0].querySelector('.meta')?.textContent).toContain('30 · 90.0 t ·');
    expect(cards[1].textContent).not.toContain(en.pickGymFavourite);
    expect(cards[1].querySelector('.meta')?.textContent).toContain(`2 · 1.0 t · ${en.stNever}`);
    expect(cards[1].querySelector('.profile-gym-coords')?.textContent).toBe('5.12346, 6.00000');
    fireEvent.click(cards[0]);
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'gym',
      gymId: 'g1',
      name: 'Iron Yard',
      lat: 1,
      lng: 2,
    });
    fireEvent.keyDown(cards[1], { key: 'Enter' });
    expect(shell.openOverlay).toHaveBeenLastCalledWith(expect.objectContaining({ gymId: 'g2' }));
    fireEvent.keyDown(cards[1], { key: ' ' });
    const n = (shell.openOverlay as ReturnType<typeof vi.fn>).mock.calls.length;
    fireEvent.keyDown(cards[1], { key: 'x' });
    expect(shell.openOverlay).toHaveBeenCalledTimes(n);
  });

  it('recent sessions show gym, length, exercises and sets · volume; only the latest twelve', async () => {
    const mk = (i: number, over: Record<string, unknown> = {}) => ({
      id: `s${i}`,
      startedAt: NOW - i * DAY,
      finishedAt: NOW - i * DAY + 1000,
      autoFinished: false,
      live: false,
      durationMs: 3_600_000,
      gymName: 'Iron Yard',
      sets: 10 + i,
      exercises: 2,
      volumeKg: 1000,
      exerciseNames: ['A', 'B'],
      ...over,
    });
    pm.data.me = profile({ sessions: Array.from({ length: 14 }, (_, i) => mk(i + 1)) });
    const { container } = open();
    await loaded();
    const rows = container.querySelectorAll('.profile-sessions > *');
    expect(rows).toHaveLength(12);
    expect(rows[0].textContent).toContain('Iron Yard · 1:00 · A, B');
    expect(rows[0].textContent).toContain('11 · 1.0 t');
  });

  it('session length falls back to "auto-closed" or nothing, and a missing gym is a dash', async () => {
    const base = {
      startedAt: NOW - DAY,
      finishedAt: null,
      live: false,
      sets: 1,
      exercises: 0,
      volumeKg: 0,
      exerciseNames: [] as string[],
    };
    pm.data.me = profile({
      sessions: [
        { ...base, id: 'a', autoFinished: true, durationMs: null, gymName: null },
        { ...base, id: 'b', autoFinished: false, durationMs: null, gymName: 'G' },
      ],
    });
    const { container } = open();
    await loaded();
    const rows = container.querySelectorAll('.profile-sessions > *');
    expect(rows[0].textContent).toContain(`— · ${en.autoClosed}`);
    expect(rows[1].textContent).toContain('G · ');
    expect(rows[1].textContent).not.toContain(en.autoClosed);
  });

  it('my own sessions open the past workout, or the live session while it runs', async () => {
    pm.data.me = profile({
      sessions: [
        {
          id: 'p',
          startedAt: NOW - DAY,
          finishedAt: NOW,
          autoFinished: false,
          live: false,
          durationMs: 1000,
          gymName: 'G',
          sets: 1,
          exercises: 0,
          volumeKg: 0,
          exerciseNames: [],
        },
        {
          id: 'l',
          startedAt: NOW,
          finishedAt: null,
          autoFinished: false,
          live: true,
          durationMs: null,
          gymName: 'G',
          sets: 1,
          exercises: 0,
          volumeKg: 0,
          exerciseNames: [],
        },
      ],
    });
    const { shell, container } = open();
    await loaded();
    const rows = container.querySelectorAll('.profile-sessions > *');
    fireEvent.click(rows[0]);
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'past-workout', workoutId: 'p' });
    fireEvent.click(rows[1]);
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'session', workoutId: 'l' });
  });
});

describe('ProfileView: my settings', () => {
  const settings = async (over: Record<string, unknown> = {}) => {
    pm.data.me = profile(over);
    const out = open();
    await loaded();
    tab(en.profileSettings);
    return out;
  };

  it('shows the privacy vault, units, week start, quiet hours and the coach row', async () => {
    await settings();
    expect(screen.getByTestId('vault')).toBeTruthy();
    expect(screen.getByTestId('quiet')).toBeTruthy();
    expect(screen.getByLabelText(en.weekStartsOn)).toBeTruthy();
    expect(screen.getByText(en.profileUnits)).toBeTruthy();
  });

  it('the unit switch changes the account weight unit', async () => {
    await settings();
    expect(__getStateForTests().weightUnit).toBe('kg');
    fireEvent.click(screen.getByRole('button', { name: 'lb' }));
    expect(__getStateForTests().weightUnit).toBe('lb');
    fireEvent.click(screen.getByRole('button', { name: 'kg' }));
    expect(__getStateForTests().weightUnit).toBe('kg');
  });

  it('the week-start select lists seven days and stores the choice', async () => {
    await settings();
    const sel = screen.getByLabelText(en.weekStartsOn) as HTMLSelectElement;
    expect([...sel.options].map((o) => o.textContent)).toEqual(en.weekDayNames);
    expect(sel.value).toBe('1');
    fireEvent.change(sel, { target: { value: '7' } });
    expect((screen.getByLabelText(en.weekStartsOn) as HTMLSelectElement).value).toBe('7');
    expect(pm.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ weekStart: 7 }),
      expect.anything(),
    );
    fireEvent.change(sel, { target: { value: '1' } });
  });

  it('the Atlas row names the coach and its temper only when enabled, and opens it', async () => {
    const { shell } = await settings();
    fireEvent.click(screen.getByText(new RegExp(`^${en.atlasName}`)));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'coach' });
  });

  it('conditions open the health overlay', async () => {
    const { shell } = await settings();
    fireEvent.click(screen.getByText('conditions row'));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'health' });
  });

  it('lists who can see my data with their access level, or says nobody does', async () => {
    await settings({
      access: [
        { id: 'ad', name: 'Boss Admin', role: 'admin' },
        { id: 'tr', name: 'Carl Coach', role: 'trainer' },
      ],
    });
    const rows = document.querySelectorAll('.access-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain(`${en.roleAdmin} · ${en.profFullAccess}`);
    expect(rows[1].textContent).toContain(`${en.roleTrainer} · ${en.profReads}`);
    cleanup();
    await settings({ access: [] });
    expect(screen.getAllByText(en.profNoAccess).length).toBeGreaterThan(0);
  });

  it('the audit log names who read the profile and falls back to the role for system reads', async () => {
    await settings({
      audit: [
        { at: NOW - DAY, resource: 'profile', readerName: 'Carl Coach', readerRole: 'trainer' },
        { at: NOW - 2 * DAY, resource: 'history', readerName: null, readerRole: 'admin' },
      ],
    });
    const rows = document.querySelectorAll('.profile-audit-section .profile-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Carl Coach');
    expect(rows[0].textContent).toContain(`${en.roleTrainer} · profile`);
    expect(rows[1].querySelector('.n')?.textContent).toBe(en.roleAdmin);
  });

  it('an empty audit log says so', async () => {
    await settings({ audit: [] });
    const sec = document.querySelector('.profile-audit-section')!;
    expect(sec.textContent).toContain(en.profNoAccess);
  });

  it('the body tab edits my own metrics', async () => {
    pm.data.me = profile();
    open();
    await loaded();
    tab(en.profTabBody);
    expect(screen.getByTestId('body').getAttribute('data-readonly')).toBe('false');
  });
});
