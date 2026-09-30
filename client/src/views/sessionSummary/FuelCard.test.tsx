import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FuelCard } from './FuelCard';
import { __getStateForTests, __replaceStateForTests } from '../../store';
import { setLocale } from '../../i18n';
import type { ChronicCondition, Gym, Workout } from '../../types';

const MIN = 60_000;
const END = new Date(2026, 8, 28, 18, 30).getTime();
const workout = (): Workout => ({
  id: 'w',
  startedAt: END - 75 * MIN,
  finishedAt: END,
  autoFinished: false,
  gymId: 'g1',
  exercises: [
    {
      id: 'e',
      name: 'Squat',
      position: 0,
      kind: 'strength',
      primaryMuscle: 'quads',
      sets: Array.from({ length: 12 }, (_, i) => ({
        id: `s${i}`,
        reps: 6,
        weight: 100,
        isWarmup: false,
        rpe: 8.5,
        position: i,
      })),
    },
  ],
});
const gym: Gym = { id: 'g1', name: 'Club', lat: 0, lng: 0, radiusM: 50, amenities: ['juiceBar'] };

function seed(conditions: ChronicCondition[] = []) {
  __replaceStateForTests({ ...__getStateForTests(), gyms: [gym], conditions });
}

beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('FuelCard', () => {
  it('shows the idea, why it fits, and that the gym has a juice bar', () => {
    seed();
    render(<FuelCard workout={workout()} />);
    expect(screen.getByText('Recovery fuel')).toBeTruthy();
    expect(screen.getByText('Protein shake')).toBeTruthy();
    expect(
      screen.getByText('12 working sets on legs, RPE 8.5 — easy protein to support recovery'),
    ).toBeTruthy();
    expect(screen.getByText('You can get it at the gym')).toBeTruthy();
    expect(screen.getByText('General wellness ideas, not medical advice.')).toBeTruthy();
  });

  it('with an active diabetes condition it only says to check with a doctor or dietitian', () => {
    seed([{ id: 'c', key: 'meta_diabetes2', severity: 2, share: 'inherit', createdAt: 0 }]);
    render(<FuelCard workout={workout()} />);
    expect(screen.getByText(/Check with your doctor or dietitian/)).toBeTruthy();
    expect(screen.queryByText('Protein shake')).toBeNull();
  });

  it('renders nothing for an empty workout', () => {
    seed();
    const { container } = render(<FuelCard workout={{ ...workout(), exercises: [] }} />);
    expect(container.firstChild).toBeNull();
  });
});
