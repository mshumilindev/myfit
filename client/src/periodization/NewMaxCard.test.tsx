import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ week: 2 as number }));
vi.mock('../store', () => ({
  useStore: () => ({}),
  getStoreState: () => ({
    workouts: [
      {
        id: 'w',
        startedAt: Date.now() - 3_600_000,
        exercises: [
          {
            id: 'e',
            name: 'Barbell Squat',
            kind: 'strength',
            position: 0,
            sets: [{ id: 's', reps: 3, weight: 160, isWarmup: false }],
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
      week: m.week,
      program: {
        items: [],
        cycle: {
          length: 2,
          weeks: [{ label: 'test', dayNames: {}, targetMuscles: {}, items: [] }],
        },
      },
    },
  }),
}));
vi.mock('./maxesSync', async () => {
  const actual = await vi.importActual<typeof import('./maxesSync')>('./maxesSync');
  return { ...actual, saveMax: vi.fn(async () => {}) };
});

import { NewMaxCard } from './NewMaxCard';
import { EMPTY_MAXES, withMax } from './maxesData';
import { saveMax, seedMaxes } from './maxesSync';

const workout = {
  id: 'w',
  exercises: [
    {
      id: 'e',
      name: 'Barbell Squat',
      sets: [{ id: 's', reps: 3, weight: 160, isWarmup: false }],
    },
  ],
} as never;

afterEach(() => {
  cleanup();
  seedMaxes(EMPTY_MAXES);
  vi.clearAllMocks();
  m.week = 2;
});

describe('New max? after a test week', () => {
  it('asks when the history now implies more than the typed max, and raises it on one tap', async () => {
    seedMaxes(withMax(EMPTY_MAXES, 'Barbell Squat', 150, 1));
    render(<NewMaxCard workout={workout} />);
    expect(screen.getByText('New max?')).toBeTruthy();
    expect(screen.getByText('Barbell Squat: 150 → 176 kg')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(saveMax).toHaveBeenCalledWith('Barbell Squat', 176));
    expect(await screen.findByText('Saved')).toBeTruthy();
  });
  it('"Not now" hides it without saving', () => {
    seedMaxes(withMax(EMPTY_MAXES, 'Barbell Squat', 150, 1));
    render(<NewMaxCard workout={workout} />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByText('New max?')).toBeNull();
    expect(saveMax).not.toHaveBeenCalled();
  });
  it('not in a normal week', () => {
    m.week = 1;
    seedMaxes(withMax(EMPTY_MAXES, 'Barbell Squat', 150, 1));
    render(<NewMaxCard workout={workout} />);
    expect(screen.queryByText('New max?')).toBeNull();
  });
  it('not when the typed max is already as high as the history, or when no max was typed', () => {
    seedMaxes(withMax(EMPTY_MAXES, 'Barbell Squat', 200, 1));
    const a = render(<NewMaxCard workout={workout} />);
    expect(a.container.textContent).toBe('');
    cleanup();
    seedMaxes(EMPTY_MAXES);
    const b = render(<NewMaxCard workout={workout} />);
    expect(b.container.textContent).toBe('');
  });
});
