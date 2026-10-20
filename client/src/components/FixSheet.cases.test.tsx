import { currentHash } from '../route';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { FixCandidate } from '../fixit';
import type { Gym, Workout } from '../types';

const addExercise = vi.fn();
const startWorkout = vi.fn();
let cands: FixCandidate[] = [];

vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  addExercise: (...a: unknown[]) => addExercise(...a),
  startWorkout: (...a: unknown[]) => startWorkout(...a),
}));
vi.mock('../fixit', async (orig) => ({
  ...(await orig<typeof import('../fixit')>()),
  fixCandidates: () => cands,
}));

import { FixSheet } from './FixSheet';

const cand = (over: Partial<FixCandidate>): FixCandidate =>
  ({
    name: 'Bench Press',
    primary: 'chest',
    secondary: ['triceps', 'shoulders', 'core'],
    equipment: ['barbell'],
    missing: [],
    available: true,
    bodyweight: false,
    isPrimaryHit: true,
    scheme: { sets: 4, reps: 8, label: '4 × 8' },
    ...over,
  }) as FixCandidate;

const gym = (id: string, name: string): Gym => ({ id, name, equipment: [] }) as unknown as Gym;
const wo = (over: Partial<Workout>): Workout => ({
  id: 'w',
  startedAt: 1,
  finishedAt: null,
  autoFinished: false,
  exercises: [],
  ...over,
});
function setState(patch: { gyms?: Gym[]; workouts?: Workout[] }) {
  __replaceStateForTests({ ...__getStateForTests(), gyms: [], workouts: [], ...patch });
}

beforeEach(() => {
  setLocale('en');
  addExercise.mockReset();
  startWorkout.mockReset();
  cands = [cand({})];
  window.location.hash = '';
});
afterEach(cleanup);

describe('FixSheet', () => {
  it('titles the sheet with the muscle and hints to link a gym when there is none', () => {
    setState({});
    render(<FixSheet muscle="chest" onClose={() => undefined} />);
    expect(screen.getByText('Add Chest work')).toBeTruthy();
    expect(screen.getByText('Link a gym to see what you can do where you train.')).toBeTruthy();
  });

  it('shows an empty state when nothing matches', () => {
    setState({});
    cands = [];
    render(<FixSheet muscle="chest" onClose={() => undefined} />);
    expect(screen.getByText('No matching exercises found.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add to session|Start session/ })).toBeNull();
  });

  it('with no gym lists the equipment instead of availability', () => {
    setState({});
    render(<FixSheet muscle="chest" onClose={() => undefined} />);
    expect(document.querySelector('.fix-avail.neutral')).toBeTruthy();
    expect(screen.getByText('4 × 8')).toBeTruthy();
  });

  it('labels bodyweight moves as anywhere even with a gym', () => {
    setState({ gyms: [gym('g1', 'Iron')] });
    cands = [cand({ name: 'Push-up', bodyweight: true, equipment: [] })];
    render(<FixSheet muscle="chest" onClose={() => undefined} />);
    expect(document.querySelector('.fix-avail.any')!.textContent).toBe('Bodyweight — anywhere');
  });

  it('marks gym availability: ok when equipped, warn with the missing kit when not', () => {
    setState({ gyms: [gym('g1', 'Iron')] });
    cands = [
      cand({ name: 'A', available: true }),
      cand({ name: 'B', available: false, missing: ['cable', 'barbell'] }),
    ];
    render(<FixSheet muscle="chest" onClose={() => undefined} />);
    expect(screen.getByText('Available at Iron')).toBeTruthy();
    const warn = document.querySelector('.fix-avail.warn')!.textContent!;
    expect(warn).toMatch(/^Needs .* · .* — not at your gym$/);
  });

  it('shows at most two secondary muscle chips', () => {
    setState({});
    render(<FixSheet muscle="chest" onClose={() => undefined} />);
    expect(document.querySelectorAll('.fix-chips > *')).toHaveLength(3);
  });

  it('omits chips for a candidate without a primary muscle', () => {
    setState({});
    cands = [cand({ primary: null })];
    render(<FixSheet muscle="chest" onClose={() => undefined} />);
    expect(document.querySelector('.fix-chips')).toBeNull();
  });

  it('adds to the open session with the planned scheme and marks the card done', () => {
    setState({ gyms: [gym('g1', 'Iron')], workouts: [wo({ id: 'open1', finishedAt: null })] });
    render(<FixSheet muscle="chest" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to session' }));
    expect(startWorkout).not.toHaveBeenCalled();
    expect(addExercise).toHaveBeenCalledWith('open1', 'Bench Press', 'strength', {
      plannedSets: 4,
      plannedReps: 8,
      primaryMuscle: 'chest',
      secondaryMuscles: ['triceps', 'shoulders', 'core'],
      equipment: ['barbell'],
    });
    const done = screen.getByRole('button', { name: 'Added' }) as HTMLButtonElement;
    expect(done.disabled).toBe(true);
    expect(document.querySelector('.fix-card.done')).toBeTruthy();
  });

  it('starts a session at the active gym when none is open, then adds', () => {
    setState({ gyms: [gym('g1', 'Iron')] });
    startWorkout.mockReturnValue({ id: 'new1' });
    render(<FixSheet muscle="chest" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start session + add' }));
    expect(startWorkout).toHaveBeenCalledWith('g1');
    expect(addExercise).toHaveBeenCalledWith('new1', 'Bench Press', 'strength', expect.anything());
    expect(screen.getByRole('button', { name: 'Added — session started' })).toBeTruthy();
  });

  it('the active gym is the one trained at most recently, not just the first saved', () => {
    setState({
      gyms: [gym('g1', 'Iron'), gym('g2', 'Home')],
      workouts: [
        wo({ id: 'old', startedAt: 100, finishedAt: 200, gymId: 'g1' }),
        wo({ id: 'new', startedAt: 500, finishedAt: 600, gymId: 'g2' }),
      ],
    });
    startWorkout.mockReturnValue({ id: 'n' });
    render(<FixSheet muscle="chest" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start session + add' }));
    expect(startWorkout).toHaveBeenCalledWith('g2');
  });

  it('starts a gym-less session when there is no gym, and does nothing if it cannot start', () => {
    setState({});
    startWorkout.mockReturnValue(null);
    render(<FixSheet muscle="chest" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start session + add' }));
    expect(startWorkout).toHaveBeenCalledWith(null);
    expect(addExercise).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^Added/ })).toBeNull();
  });

  it('opens the exercise detail (URL-encoded) and closes the sheet', () => {
    setState({});
    cands = [cand({ name: 'Cable Fly / Low' })];
    const onClose = vi.fn();
    render(<FixSheet muscle="chest" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cable Fly / Low' }));
    expect(currentHash()).toBe('#/exercise-detail/Cable%20Fly%20%2F%20Low');
    expect(onClose).toHaveBeenCalled();
  });
});
