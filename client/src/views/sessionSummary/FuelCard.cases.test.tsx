import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import type { Exercise, Gym, Workout } from '../../types';
import { emptyState, freezeClock, seed } from '../__fixtures__/viewKit';
import { FuelCard } from './FuelCard';

const MIN = 60_000;
const at = (h: number, m = 0) => new Date(2026, 8, 28, h, m).getTime();

const strength = (n: number, rpe: number | undefined, muscle = 'chest'): Exercise =>
  ({
    id: 'e',
    name: 'Bench Press',
    position: 0,
    kind: 'strength',
    primaryMuscle: muscle,
    sets: Array.from({ length: n }, (_, i) => ({
      id: `s${i}`,
      reps: 8,
      weight: 60,
      isWarmup: false,
      rpe,
      position: i,
    })),
  }) as Exercise;
const cardio = (min: number): Exercise =>
  ({
    id: 'c',
    name: 'Treadmill Running',
    position: 1,
    kind: 'cardio',
    sets: [{ id: 'cs', reps: 0, weight: null, isWarmup: false, durationMin: min }],
  }) as Exercise;
const wo = (finishH: number, minutes: number, exercises: Exercise[], gymId?: string): Workout =>
  ({
    id: 'w',
    startedAt: at(finishH) - minutes * MIN,
    finishedAt: at(finishH),
    autoFinished: false,
    gymId,
    exercises,
  }) as Workout;
const gym = (amenities: string[]): Gym =>
  ({ id: 'g', name: 'Club', lat: 0, lng: 0, radiusM: 50, amenities }) as Gym;
const kinds = () =>
  [...document.querySelectorAll('[data-kind]')].map((e) => e.getAttribute('data-kind'));
const reasons = () =>
  [...document.querySelectorAll('[data-kind] .ut-dim')].map((e) => e.textContent);

beforeEach(() => {
  freezeClock(at(20));
  setLocale('en');
  seed({ ...emptyState(), gyms: [gym(['cafe'])] });
});
afterEach(cleanup);

describe('FuelCard: what is suggested for which session', () => {
  it('a very big lifting day: a carb meal first, then the protein shake, each explained by the sets', () => {
    render(<FuelCard workout={wo(18, 80, [strength(20, 8)])} />);
    expect(kinds()).toEqual(['carbMeal', 'proteinShake']);
    expect(reasons()[0]).toBe(en.fuelReason('carbMeal', en.fuelFacts(20, 'push', 8, 80, 0)));
    expect(reasons()[1]).toBe(en.fuelReason('proteinShake', en.fuelFacts(20, 'push', 8, 0, 0)));
  });

  it('a long cardio-only session: water with electrolytes and a smoothie, explained by minutes of cardio', () => {
    render(<FuelCard workout={wo(18, 50, [cardio(45)])} />);
    expect(kinds()).toEqual(['hydrate', 'smoothie']);
    expect(reasons()[0]).toBe(en.fuelReason('hydrate', en.fuelFacts(0, null, null, 50, 45)));
    expect(reasons()[1]).toBe(en.fuelReason('smoothie', en.fuelFacts(0, null, null, 50, 45)));
  });

  it('a light lifting session gets a smoothie and a snack, the smoothie explained by the sets', () => {
    render(<FuelCard workout={wo(18, 30, [strength(4, 6)])} />);
    expect(kinds()).toEqual(['smoothie', 'snack']);
    expect(reasons()[0]).toBe(en.fuelReason('smoothie', en.fuelFacts(4, 'push', null, 30, 0)));
    expect(reasons()[1]).toBe(en.fuelReason('snack', en.fuelFacts(4, 'push', null, 30, 0)));
  });

  it('a hard session that finishes late in the evening gets a light snack instead of a heavy meal', () => {
    render(<FuelCard workout={wo(22, 90, [strength(18, 9)])} />);
    expect(kinds()).toContain('snack');
    expect(kinds()).not.toContain('carbMeal');
  });

  it('a middling session still gets something: the fallback snack', () => {
    render(<FuelCard workout={wo(18, 45, [strength(9, 7.5)])} />);
    expect(kinds()).toEqual(['snack']);
  });
});

describe('FuelCard: what the gym sells', () => {
  it('a cafe covers the meal and the shake; water is never "at the gym"', () => {
    render(<FuelCard workout={wo(18, 80, [strength(20, 8), cardio(35)], 'g')} />);
    const rows = [...document.querySelectorAll('[data-kind]')];
    expect(rows.map((r) => r.getAttribute('data-kind'))).toEqual(['carbMeal', 'proteinShake']);
    expect(rows.every((r) => r.textContent?.includes(en.fuelAtGym))).toBe(true);
    cleanup();
    render(<FuelCard workout={wo(18, 50, [cardio(45)], 'g')} />);
    const hydrate = document.querySelector('[data-kind="hydrate"]') as HTMLElement;
    expect(hydrate.textContent).not.toContain(en.fuelAtGym);
    expect(document.querySelector('[data-kind="smoothie"]')?.textContent).toContain(en.fuelAtGym);
  });

  it('a gym with only a juice bar sells the shake but not the meal', () => {
    seed({ ...emptyState(), gyms: [gym(['juiceBar'])] });
    render(<FuelCard workout={wo(18, 80, [strength(20, 8)], 'g')} />);
    expect(document.querySelector('[data-kind="carbMeal"]')?.textContent).not.toContain(
      en.fuelAtGym,
    );
    expect(document.querySelector('[data-kind="proteinShake"]')?.textContent).toContain(
      en.fuelAtGym,
    );
  });

  it('a workout at a gym that is no longer saved is treated as having no facilities', () => {
    seed({ ...emptyState(), gyms: [] });
    render(<FuelCard workout={wo(18, 80, [strength(20, 8)], 'gone')} />);
    expect(screen.queryByText(en.fuelAtGym)).toBeNull();
    expect(kinds()).toEqual(['carbMeal', 'proteinShake']);
  });
});
