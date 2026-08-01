import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Shell } from '../client/src/App';
import type { StoreState } from '../client/src/store';
import { setLocale } from '../client/src/i18n';
import { TodayView } from '../client/src/views/TodayView';
import { ProgressView } from '../client/src/views/ProgressView';
import { GymsView } from '../client/src/views/GymsView';
import { ServicesView } from '../client/src/views/ServicesView';
import { SessionView } from '../client/src/views/SessionView';
import { AuthView } from '../client/src/views/AuthView';
import { ExerciseHistoryView } from '../client/src/views/ExerciseHistoryView';
import { __replaceStateForTests } from '../client/src/store';

const shell: Shell = {
  openOverlay: vi.fn(),
  toast: vi.fn(),
  snack: vi.fn(),
};

function store(patch: Partial<StoreState> = {}): StoreState {
  return {
    workouts: [],
    gyms: [],
    reminders: [],
    queue: [],
    syncStatus: 'synced',
    lastSyncAt: Date.now(),
    ...patch,
  };
}

function sampleStore(): StoreState {
  const now = Date.now();
  return store({
    workouts: [
      {
        id: 'open',
        startedAt: now - 30 * 60000,
        finishedAt: null,
        autoFinished: false,
        exercises: [
          {
            id: 'bench',
            name: 'Bench press',
            position: 0,
            sets: [{ id: 's1', reps: 8, weight: 80, isWarmup: false, position: 0 }],
          },
        ],
      },
      {
        id: 'done',
        startedAt: now - 2 * 24 * 3600_000,
        finishedAt: now - 2 * 24 * 3600_000 + 3600_000,
        autoFinished: false,
        exercises: [
          {
            id: 'squat',
            name: 'Squat',
            position: 0,
            sets: [{ id: 's2', reps: 8, weight: 100, isWarmup: false, position: 0 }],
          },
        ],
      },
    ],
    gyms: [{ id: 'g1', name: 'Smartfit', lat: 50.45, lng: 30.52, radiusM: 150 }],
  });
}

describe('F-02/F-08 shell views and design states', () => {
  it('renders Today live state and opens session overlay', async () => {
    const s = sampleStore();
    render(<TodayView shell={shell} store={s} />);

    expect(screen.getByRole('heading', { name: 'Mid-session.' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Session in progress/ }));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'session', workoutId: 'open' });
  });

  it('renders Progress locked state before three sessions', () => {
    render(<ProgressView store={sampleStore()} />);

    expect(screen.getByRole('heading', { name: 'Progress' })).toBeTruthy();
    expect(screen.getByText('Two more sessions')).toBeTruthy();
  });

  it('renders Gyms list and gates manual location behind a typed name', async () => {
    render(<GymsView shell={shell} store={sampleStore()} />);

    expect(screen.getByRole('heading', { name: 'Gyms' })).toBeTruthy();
    expect(screen.getByText('Smartfit')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /I'm here/ })).toBeNull();

    await userEvent.type(screen.getByPlaceholderText('Search for a gym'), 'New gym');

    expect(screen.getByRole('button', { name: /New gym.*I'm here/ })).toBeTruthy();
  });

  it('renders Services with language picker and switches locale', async () => {
    const onSignedOut = vi.fn();
    const onOpenTraining = vi.fn();
    render(
      <ServicesView
        store={sampleStore()}
        onSignedOut={onSignedOut}
        onOpenTraining={onOpenTraining}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Services' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Українська' }));
    expect(document.documentElement.lang).toBe('uk');
    setLocale('en');
  });

  it('opens sign-out confirm dialog from Services', async () => {
    render(<ServicesView store={sampleStore()} onSignedOut={vi.fn()} onOpenTraining={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(
      screen.getByText('Your log stays on the server and comes back on the next sign-in.'),
    ).toBeTruthy();
  });
});

describe('F-03 session UI', () => {
  it('renders a live session without tabbar and exposes ghost row logging', () => {
    const s = sampleStore();
    __replaceStateForTests(s);
    render(<SessionView workoutId="open" shell={shell} onClose={vi.fn()} />);

    expect(screen.getByText('In session · Smartfit')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('opens add exercise, set editor and exercise menu sheets', async () => {
    const s = sampleStore();
    __replaceStateForTests(s);
    render(<SessionView workoutId="open" shell={shell} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    expect(screen.getByPlaceholderText('Add exercise')).toBeTruthy();

    cleanup();
    __replaceStateForTests(s);
    render(<SessionView workoutId="open" shell={shell} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /1880record/ }));
    expect(screen.getByText('Set 1 · Bench press')).toBeTruthy();

    cleanup();
    __replaceStateForTests(s);
    render(<SessionView workoutId="open" shell={shell} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByText('Bench press · 1 sets')).toBeTruthy();
  });
});

describe('F-01 auth UI', () => {
  it('renders sign-up validation and submits registration', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ registered: false }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ token: 'token', username: 'demo' }), { status: 200 }),
        ),
    );
    const onLoggedIn = vi.fn();
    render(<AuthView onLoggedIn={onLoggedIn} />);

    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeTruthy();
    await userEvent.type(screen.getByPlaceholderText('Username'), 'demo');
    await userEvent.type(screen.getByPlaceholderText('Email'), 'demo@example.com');
    await userEvent.type(screen.getByPlaceholderText('Password (min. 6 characters)'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /Create account/ }));

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalled());
  });

  it('renders sign-in errors and retry for unreachable server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('offline')));
    render(<AuthView onLoggedIn={vi.fn()} />);

    expect(await screen.findByText(/Can't reach the server/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});

describe('F-06 progress and history UI', () => {
  function richStore(): StoreState {
    const now = Date.now();
    return store({
      workouts: [0, 1, 2].map((i) => ({
        id: `w${i}`,
        startedAt: now - i * 7 * 24 * 3600_000,
        finishedAt: now - i * 7 * 24 * 3600_000 + 3600_000,
        autoFinished: false,
        exercises: [
          {
            id: `e${i}`,
            name: 'Squat',
            position: 0,
            sets: [{ id: `s${i}`, reps: 5 + i, weight: 100 + i * 5, isWarmup: false, position: 0 }],
          },
        ],
      })),
    });
  }

  it('renders filled Progress metrics after three sessions', () => {
    render(<ProgressView store={richStore()} />);

    expect(screen.getByText('Volume this week')).toBeTruthy();
    expect(screen.getByText('Estimated 1RM')).toBeTruthy();
    expect(screen.getByText('Records')).toBeTruthy();
  });

  it('renders exercise history chart/table for repeated lift', () => {
    __replaceStateForTests(richStore());
    render(<ExerciseHistoryView name="Squat" onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Squat' })).toBeTruthy();
    expect(screen.getByText('Top set · 12 weeks')).toBeTruthy();
    expect(screen.getByText('Last sessions')).toBeTruthy();
  });
});
