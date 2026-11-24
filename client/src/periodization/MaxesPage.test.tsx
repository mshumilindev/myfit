import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../store', () => ({
  useStore: () => ({}),
  getStoreState: () => ({
    workouts: [
      {
        id: 'w',
        startedAt: Date.now() - 86_400_000,
        exercises: [
          {
            id: 'e',
            name: 'Barbell Squat',
            kind: 'strength',
            position: 0,
            sets: [{ id: 's', reps: 3, weight: 127, isWarmup: false }],
          },
        ],
      },
    ],
  }),
  est1rm: (weight: number, reps: number) =>
    weight <= 0 || reps < 1 || reps > 10 ? 0 : Math.round(weight * (1 + reps / 30)),
}));
vi.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));
vi.mock('../data/programMine', () => ({
  useProgramMine: () => ({
    assignment: {
      program: {
        items: [
          { name: 'Barbell Squat', targetPct: 85 },
          { name: 'Weighted Pullups', targetPct: 70 },
          { name: 'Plank' },
        ],
      },
    },
    active: true,
  }),
}));
vi.mock('./maxesSync', async () => {
  const actual = await vi.importActual<typeof import('./maxesSync')>('./maxesSync');
  return { ...actual, saveMax: vi.fn(async () => {}), clearMax: vi.fn(async () => {}) };
});

import { MaxesPage } from './MaxesPage';
import { EMPTY_MAXES, withMax } from './maxesData';
import { clearMax, saveMax, seedMaxes } from './maxesSync';

afterEach(() => {
  cleanup();
  seedMaxes(EMPTY_MAXES);
  vi.clearAllMocks();
});

describe('Maxes page', () => {
  it('lists the exercises a program asks a percent for, with the estimate or "No max yet"', () => {
    render(<MaxesPage onClose={() => {}} />);
    expect(screen.getByText('Barbell Squat')).toBeTruthy();
    expect(screen.getByText('140 kg')).toBeTruthy();
    expect(screen.getByText(/From history · est\./)).toBeTruthy();
    expect(screen.getByText('Weighted Pullups')).toBeTruthy();
    expect(screen.getByText('No max yet')).toBeTruthy();
    expect(screen.queryByText('Plank')).toBeNull();
  });
  it('shows a typed max as "You set this"', () => {
    seedMaxes(withMax(EMPTY_MAXES, 'Barbell Squat', 150, 1));
    render(<MaxesPage onClose={() => {}} />);
    expect(screen.getByText('150 kg')).toBeTruthy();
    expect(screen.getByText(/You set this/)).toBeTruthy();
  });
  it('types a max for an exercise and saves it', async () => {
    render(<MaxesPage onClose={() => {}} />);
    fireEvent.click(screen.getByText('Weighted Pullups'));
    fireEvent.click(screen.getByRole('button', { name: 'Type it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saveMax).toHaveBeenCalledWith('Weighted Pullups', 100));
  });
  it('takes the estimate from history again by clearing the typed max', async () => {
    seedMaxes(withMax(EMPTY_MAXES, 'Barbell Squat', 150, 1));
    render(<MaxesPage onClose={() => {}} />);
    fireEvent.click(screen.getByText('Barbell Squat'));
    fireEvent.click(screen.getByRole('button', { name: 'From history' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(clearMax).toHaveBeenCalledWith('Barbell Squat'));
  });
  it('says so and stays when a save does not go through', async () => {
    vi.mocked(saveMax).mockRejectedValueOnce(new Error('offline'));
    render(<MaxesPage onClose={() => {}} />);
    fireEvent.click(screen.getByText('Weighted Pullups'));
    fireEvent.click(screen.getByRole('button', { name: 'Type it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Couldn't save/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });
});
