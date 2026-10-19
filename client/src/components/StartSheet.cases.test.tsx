import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import type { ProgramAssignment } from '../data/programMine';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { Gym, RestPeriod, SetEntry, Workout } from '../types';
import { StartSheet } from './StartSheet';

// The assigned program comes from the network layer: replace only that hook, keep the real day helpers.
const programState: { assignment: ProgramAssignment | null; active: boolean } = {
  assignment: null,
  active: true,
};
vi.mock('../data/programMine', async (orig) => ({
  ...(await orig<typeof import('../data/programMine')>()),
  useProgramMine: () => programState,
}));
// Nearby-gym search is a network call.
vi.mock('../data/gymProviders', async (orig) => ({
  ...(await orig<typeof import('../data/gymProviders')>()),
  searchNearbyGyms: async () => [],
}));

const DAY = 86400000;
// Wednesday 14 Oct 2026, 18:00 local.
const NOW = new Date(2026, 9, 14, 18, 0).getTime();
const gym: Gym = { id: 'g1', name: 'Smartfit', lat: 50.45, lng: 30.52, radiusM: 150 };

const shell = () =>
  ({
    openOverlay: vi.fn(),
    replaceOverlay: vi.fn(),
    goTab: vi.fn(),
    goPlaybook: vi.fn(),
    openStart: vi.fn(),
    toast: vi.fn(),
    snack: vi.fn(),
    signOut: vi.fn(),
    queueLength: 0,
  }) as unknown as Shell &
    Record<
      | 'openOverlay'
      | 'replaceOverlay'
      | 'goTab'
      | 'goPlaybook'
      | 'openStart'
      | 'toast'
      | 'snack'
      | 'signOut',
      ReturnType<typeof vi.fn>
    >;

const sets = (n: number, p: string, at: number): SetEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    id: p + i,
    reps: 8,
    weight: 80,
    isWarmup: false,
    position: i,
    loggedAt: at + i * 120000,
  }));
function done(id: string, startedAt: number, dayName?: string): Workout {
  return {
    id,
    startedAt,
    finishedAt: startedAt + 3600000,
    autoFinished: false,
    ...(dayName ? { dayName } : {}),
    exercises: [
      {
        id: id + 'e',
        name: 'Bench press',
        kind: 'strength',
        position: 0,
        sets: sets(3, id, startedAt),
      },
    ],
  };
}
function seed(workouts: Workout[], extra: Record<string, unknown> = {}) {
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts,
    activities: [],
    sleeps: [],
    restPeriods: [],
    gyms: [],
    ...extra,
  });
}
/** A GPS fix: standing at (lat, lng) with the given accuracy, or no fix at all. */
function gps(fix: { lat: number; lng: number; accuracy: number } | null) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: unknown) => void, err: (e: unknown) => void) =>
        fix
          ? ok({ coords: { latitude: fix.lat, longitude: fix.lng, accuracy: fix.accuracy } })
          : err({ code: 1, PERMISSION_DENIED: 1 }),
    },
  });
}
const program = (over: Partial<ProgramAssignment['program']> = {}): ProgramAssignment => ({
  program: {
    id: 'p1',
    authorId: 'coach',
    name: 'Strength 4x',
    weeks: 8,
    daysPerWeek: 3,
    dayNames: { '3': 'Push day' },
    items: [
      {
        id: 'i1',
        day: 3,
        position: 0,
        name: 'Bench press',
        kind: 'strength',
        sets: 4,
        reps: 6,
        durationMin: null,
        equipment: ['barbell'],
      },
      {
        id: 'i2',
        day: 3,
        position: 1,
        name: 'Triceps pushdown',
        kind: 'strength',
        sets: 3,
        reps: 12,
        durationMin: null,
        equipment: [],
      },
    ],
    ...over,
  },
  assignedBy: 'coach',
  week: 2,
  done: 1,
  total: 6,
  expectedSoFar: 2,
  adherence: 0.8,
});
const heroTitle = () => document.querySelector('.ss-hero-title')!.textContent;
const liveWorkouts = () => __getStateForTests().workouts.filter((w) => w.finishedAt === null);

beforeEach(() => {
  localStorage.clear();
  programState.assignment = null;
  programState.active = true;
  gps(null);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  seed([]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StartSheet · hero', () => {
  it('offers a blank session when there is no program and no history', () => {
    render(<StartSheet shell={shell()} onClose={vi.fn()} />);
    expect(heroTitle()).toBe('From scratch');
    expect(document.querySelector('.ss-hero-kicker')!.textContent).toBe('Start a session');
    expect(document.querySelector('.ss-scratch')).toBeNull();
  });

  it('starts a blank session straight away when the GPS puts you inside a saved gym', async () => {
    seed([], { gyms: [gym] });
    gps({ lat: 50.45, lng: 30.52, accuracy: 10 });
    const sh = shell();
    const onClose = vi.fn();
    render(<StartSheet shell={sh} onClose={onClose} />);
    await userEvent.click(document.querySelector('.ss-hero') as HTMLElement);
    await waitFor(() => expect(sh.openOverlay).toHaveBeenCalled());
    const w = liveWorkouts()[0];
    expect(w.gymId).toBe('g1');
    expect(onClose).toHaveBeenCalled();
    expect(sh.openOverlay).toHaveBeenCalledWith({ screen: 'session', workoutId: w.id });
  });

  it('asks which gym when the fix is poor, then starts at the picked gym', async () => {
    seed([], { gyms: [gym] });
    gps({ lat: 50.45, lng: 30.52, accuracy: 500 }); // too imprecise to trust
    const sh = shell();
    render(<StartSheet shell={sh} onClose={vi.fn()} />);
    await userEvent.click(document.querySelector('.ss-hero') as HTMLElement);
    expect(await screen.findByText('Where are you training?')).toBeTruthy();
    expect(sh.openOverlay).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByText('Smartfit'));
    await waitFor(() => expect(sh.openOverlay).toHaveBeenCalled());
    expect(liveWorkouts()[0].gymId).toBe('g1');
  });

  it("shows today's program day and starts it with the prescription as planned exercises", async () => {
    programState.assignment = program();
    seed([done('old', NOW - 3 * DAY)], { gyms: [gym] });
    gps({ lat: 50.45, lng: 30.52, accuracy: 10 });
    const sh = shell();
    render(<StartSheet shell={sh} onClose={vi.fn()} />);
    expect(document.querySelector('.ss-hero-kicker')!.textContent).toBe('Today in program');
    expect(heroTitle()).toBe('Push day');
    expect(document.querySelector('.ss-hero-sub')!.textContent).toBe('Strength 4x · Wednesday');
    expect(document.querySelector('.ss-scratch')).not.toBeNull();
    await userEvent.click(document.querySelector('.ss-hero') as HTMLElement);
    await waitFor(() => expect(sh.openOverlay).toHaveBeenCalled());
    const w = liveWorkouts()[0];
    expect(w.dayName).toBe('Push day');
    expect(w.exercises.map((e) => [e.name, e.plannedSets, e.plannedReps])).toEqual([
      ['Bench press', 4, 6],
      ['Triceps pushdown', 3, 12],
    ]);
  });

  it('a program day with only target muscles has no "or from scratch" link', () => {
    programState.assignment = program({ items: [], targetMuscles: { '3': ['chest'] } });
    render(<StartSheet shell={shell()} onClose={vi.fn()} />);
    expect(heroTitle()).toBe('Push day');
    expect(document.querySelector('.ss-scratch')).toBeNull();
  });

  it('ignores a program that is not active, or whose day is not today', () => {
    programState.assignment = program();
    programState.active = false;
    const a = render(<StartSheet shell={shell()} onClose={vi.fn()} />);
    expect(heroTitle()).toBe('From scratch');
    a.unmount();
    programState.active = true;
    programState.assignment = program({
      items: [
        {
          id: 'i9',
          day: 5,
          position: 0,
          name: 'Squat',
          kind: 'strength',
          sets: 3,
          reps: 5,
          durationMin: null,
          equipment: [],
        },
      ],
      dayNames: {},
    });
    render(<StartSheet shell={shell()} onClose={vi.fn()} />);
    expect(heroTitle()).toBe('From scratch');
  });

  it('suggests the usual Wednesday from the playbook and starts it, with a scratch link beside it', async () => {
    seed([done('w1', NOW - 7 * DAY, 'Push day'), done('w2', NOW - 14 * DAY, 'Push day')], {
      gyms: [gym],
    });
    gps({ lat: 50.45, lng: 30.52, accuracy: 10 });
    const sh = shell();
    render(<StartSheet shell={sh} onClose={vi.fn()} />);
    expect(document.querySelector('.ss-hero-kicker')!.textContent).toBe('Your usual Wednesday');
    expect(heroTitle()).toBe('Push day');
    expect(document.querySelector('.ss-hero-sub')!.textContent).toBe(
      'From your playbook · last Oct 7',
    );
    await userEvent.click(document.querySelector('.ss-hero') as HTMLElement);
    await waitFor(() => expect(sh.openOverlay).toHaveBeenCalled());
    expect(liveWorkouts()[0].exercises.map((e) => e.name)).toContain('Bench press');
  });

  it('reports the day as done after training and lets you open it or start another', async () => {
    const today = { ...done('t1', NOW - 3 * 3600000, 'Push day') };
    seed([today], { gyms: [gym] });
    gps({ lat: 50.45, lng: 30.52, accuracy: 10 });
    const sh = shell();
    const onClose = vi.fn();
    render(<StartSheet shell={sh} onClose={onClose} />);
    expect(document.querySelector('.ss-hero-kicker')!.textContent).toBe('Trained today');
    expect(heroTitle()).toBe('Push day');
    expect(document.querySelector('.ss-hero-sub')!.textContent).toMatch(
      /^1:00 · 3 sets · 1.920 kg$/,
    );
    expect(document.querySelector('.ss-hero-go')).toBeNull();
    // the hero opens the finished session
    await userEvent.click(document.querySelector('.ss-hero') as HTMLElement);
    expect(sh.openOverlay).toHaveBeenLastCalledWith({ screen: 'past-workout', workoutId: 't1' });
    expect(onClose).toHaveBeenCalledTimes(1);
    // "Another workout" starts a blank live session at the gym we stand in
    await userEvent.click(screen.getByText('Another workout').closest('button') as HTMLElement);
    await waitFor(() => expect(liveWorkouts()).toHaveLength(1));
    expect(sh.openOverlay).toHaveBeenLastCalledWith({
      screen: 'session',
      workoutId: liveWorkouts()[0].id,
    });
  });

  it('while a session with exercises is live: shows Resume, resumes it, and locks the other starters', async () => {
    const live: Workout = {
      id: 'live',
      startedAt: NOW - 20 * 60000,
      finishedAt: null,
      autoFinished: false,
      dayName: 'Legs',
      exercises: [{ id: 'e', name: 'Squat', kind: 'strength', position: 0, sets: [] }],
    };
    seed([live]);
    const sh = shell();
    const onClose = vi.fn();
    render(<StartSheet shell={sh} onClose={onClose} />);
    expect(document.querySelector('.ss-hero-kicker')!.textContent).toBe('In progress');
    expect(heroTitle()).toBe('Legs');
    expect(document.querySelector('.ss-hero-sub')!.textContent).toBe('Resume');
    const locked = [...document.querySelectorAll('.ss-tile.locked')];
    expect(locked).toHaveLength(3);
    expect(locked[0].textContent).toContain('Finish Legs first');
    fireEvent.click(locked[0]);
    expect(sh.openOverlay).not.toHaveBeenCalled();
    await userEvent.click(document.querySelector('.ss-hero') as HTMLElement);
    expect(sh.openOverlay).toHaveBeenCalledWith({ screen: 'session', workoutId: 'live' });
    expect(onClose).toHaveBeenCalled();
    expect(liveWorkouts()).toHaveLength(1);
  });

  it('resumes a running activity or sleep from the hero', async () => {
    seed([], {
      activities: [
        {
          id: 'a',
          type: 'run',
          category: 'conditioning',
          startedAt: NOW - 600000,
          finishedAt: null,
        },
      ],
    });
    const sh = shell();
    render(<StartSheet shell={sh} onClose={vi.fn()} />);
    await userEvent.click(document.querySelector('.ss-hero') as HTMLElement);
    expect(sh.openOverlay).toHaveBeenCalledWith({ screen: 'activity' });
  });

  it('resumes a running night of sleep from the hero', async () => {
    seed([], { sleeps: [{ id: 'n', bed: NOW - 3600000, wake: null, source: 'manual' }] });
    const sh = shell();
    render(<StartSheet shell={sh} onClose={vi.fn()} />);
    await userEvent.click(document.querySelector('.ss-hero') as HTMLElement);
    expect(sh.openOverlay).toHaveBeenCalledWith({ screen: 'sleep' });
  });

  it('asks for the gym before starting the usual day when there is no usable fix', async () => {
    seed([done('w1', NOW - 7 * DAY, 'Push day'), done('w2', NOW - 14 * DAY, 'Push day')], {
      gyms: [gym],
    });
    const sh = shell();
    render(<StartSheet shell={sh} onClose={vi.fn()} />);
    await userEvent.click(document.querySelector('.ss-hero') as HTMLElement);
    expect(await screen.findByText('Where are you training?')).toBeTruthy();
    await userEvent.click(await screen.findByText('Smartfit'));
    await waitFor(() => expect(sh.openOverlay).toHaveBeenCalled());
    const w = liveWorkouts()[0];
    expect(w.gymId).toBe('g1');
    expect(w.dayName).toBe('Push day');
    expect(w.exercises.length).toBeGreaterThan(0);
  });

  it('"Another workout" with no fix asks for the gym and starts a blank session there', async () => {
    seed([done('t1', NOW - 3 * 3600000)], { gyms: [gym] });
    const sh = shell();
    render(<StartSheet shell={sh} onClose={vi.fn()} />);
    await userEvent.click(screen.getByText('Another workout').closest('button') as HTMLElement);
    await userEvent.click(await screen.findByText('Smartfit'));
    await waitFor(() => expect(sh.openOverlay).toHaveBeenCalled());
    expect(liveWorkouts()[0]).toMatchObject({ gymId: 'g1', exercises: [] });
  });

  it('warns when unwell, with the volume cap, and differently for a mental-health period', () => {
    const today = Math.floor(NOW / DAY);
    const period = (illnessKind?: 'mental'): RestPeriod => ({
      id: 'r',
      startDay: today - 1,
      endDay: today + 1,
      mode: 'illness',
      createdAt: 1,
      ...(illnessKind ? { illnessKind } : {}),
    });
    seed([], { restPeriods: [period()] });
    const a = render(<StartSheet shell={shell()} onClose={vi.fn()} />);
    expect(document.body.textContent).toContain('60');
    const first = document.querySelector('.uinotice, [class*=notice]')?.textContent;
    a.unmount();
    seed([], { restPeriods: [period('mental')] });
    render(<StartSheet shell={shell()} onClose={vi.fn()} />);
    expect(document.querySelector('.uinotice, [class*=notice]')?.textContent).not.toBe(first);
  });
});

describe('StartSheet · tiles', () => {
  const tile = (title: string) => screen.getByText(title).closest('button') as HTMLElement;

  it('Auto session opens the builder, telling it about the program (none / own / other)', async () => {
    const sh = shell();
    const onClose = vi.fn();
    const a = render(<StartSheet shell={sh} onClose={onClose} />);
    await userEvent.click(tile('Auto session'));
    expect(sh.openOverlay).toHaveBeenLastCalledWith({
      screen: 'builder',
      programMode: 'none',
      programDays: [],
    });
    expect(onClose).toHaveBeenCalled();
    a.unmount();
    programState.assignment = program();
    render(<StartSheet shell={sh} onClose={vi.fn()} />);
    await userEvent.click(tile('Auto session'));
    // authored by someone else (the uid is not the coach's)
    expect(sh.openOverlay).toHaveBeenLastCalledWith({
      screen: 'builder',
      programMode: 'other',
      programDays: [],
    });
    cleanup();
    localStorage.setItem('spotter.uid', 'coach');
    programState.assignment = program({
      items: [
        {
          id: 'a',
          day: 5,
          position: 0,
          name: 'Squat',
          kind: 'strength',
          sets: 3,
          reps: 5,
          durationMin: null,
          equipment: [],
        },
        {
          id: 'b',
          day: 1,
          position: 0,
          name: 'Row',
          kind: 'strength',
          sets: 3,
          reps: 8,
          durationMin: null,
          equipment: [],
        },
        {
          id: 'c',
          day: 5,
          position: 1,
          name: 'Lunge',
          kind: 'strength',
          sets: 3,
          reps: 8,
          durationMin: null,
          equipment: [],
        },
      ],
    });
    render(<StartSheet shell={sh} onClose={vi.fn()} />);
    await userEvent.click(tile('Auto session'));
    expect(sh.openOverlay).toHaveBeenLastCalledWith({
      screen: 'builder',
      programMode: 'own',
      programDays: [1, 5],
    });
  });

  it('Activity, Health, Programs and Home set each open their screen and close the sheet', async () => {
    const sh = shell();
    const onClose = vi.fn();
    render(<StartSheet shell={sh} onClose={onClose} />);
    await userEvent.click(tile('Activity'));
    expect(sh.openOverlay).toHaveBeenLastCalledWith({ screen: 'log-activity' });
    await userEvent.click(tile('Health'));
    expect(sh.openOverlay).toHaveBeenLastCalledWith({ screen: 'health' });
    await userEvent.click(tile('Home set'));
    expect(sh.openOverlay).toHaveBeenLastCalledWith({ screen: 'home-set' });
    await userEvent.click(tile('Programs'));
    expect(sh.goTab).toHaveBeenCalledWith('programs');
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('inline mode keeps the panel and "closing" only dismisses the sub-flow', async () => {
    const sh = shell();
    const onClose = vi.fn();
    const { container } = render(<StartSheet shell={sh} onClose={onClose} inline />);
    expect(container.querySelector('.start-inline')).not.toBeNull();
    await userEvent.click(tile('Log past'));
    expect(document.querySelector('.backfill-sheet')).not.toBeNull();
    expect(container.querySelector('.start-inline')).not.toBeNull();
    await userEvent.click(
      within(document.querySelector('.backfill-sheet .sheet-actions') as HTMLElement).getByRole(
        'button',
        { name: 'Cancel' },
      ),
    );
    expect(document.querySelector('.backfill-sheet')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Log past opens the backfill and creates a finished session, then opens it for editing', async () => {
    const sh = shell();
    render(<StartSheet shell={sh} onClose={vi.fn()} />);
    await userEvent.click(tile('Log past'));
    await userEvent.click(screen.getByRole('button', { name: 'Continue to exercises' }));
    const call = sh.openOverlay.mock.calls.at(-1)![0] as {
      screen: string;
      workoutId: string;
      startAdd: boolean;
    };
    expect(call).toMatchObject({ screen: 'past-workout', startAdd: true });
    const w = __getStateForTests().workouts.find((x) => x.id === call.workoutId)!;
    // default: yesterday 18:00 for an hour
    expect(w.startedAt).toBe(new Date(2026, 9, 13, 18, 0).getTime());
    expect(w.finishedAt).toBe(w.startedAt + 3600000);
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
