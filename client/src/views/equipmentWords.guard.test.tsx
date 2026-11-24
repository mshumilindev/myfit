/**
 * Guard: without the Equipment module none of its words show on the pages that used to carry them, in any of the five
 * locales (the module's own strings). New equipment text on these pages has to go behind the module gate or fail here.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import { resetGeoGateForTests, setGeoSearchState } from '../data/geoSearchGate';
import { registerCustomExercises } from '../data/exercises';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { LOCALES, setLocale, type LocaleId } from '../i18n';
import { freezeClock, makeShell, richState, seed, setDesktop } from './__fixtures__/viewKit';

vi.mock('../data/gymProviders', async (orig) => ({
  ...(await orig<typeof import('../data/gymProviders')>()),
  resolveAddress: () => Promise.resolve(null),
  resolveGymMeta: () => Promise.resolve(null),
  resolvePhoto: () => Promise.resolve(null),
}));
vi.mock('../components/RouteMap', () => ({ RouteMap: () => null }));

import { SessionView } from './SessionView';
import { ExerciseDetailView } from './ExerciseDetailView';
import { GymDetailView } from './GymDetailView';

const LOCS: LocaleId[] = ['en', 'uk', 'pl', 'et', 'lt'];
const KEYS = [
  'equipmentLabelField',
  'equipmentInUse',
  'equipmentNeeded',
  'equipSearchPlaceholder',
  'equipmentAll',
  'pickEquipAll',
  'pickEquipTitle',
  'fixAnywhere',
] as const;

const words = (loc: LocaleId): string[] =>
  KEYS.map((k) => (LOCALES[loc] as unknown as Record<string, unknown>)[k]).filter(
    (v): v is string => typeof v === 'string' && v.length > 3,
  );

beforeEach(() => {
  resetGeoGateForTests();
  setGeoSearchState({ on: true, ready: true, answered: true });
  freezeClock();
  setDesktop(false);
  localStorage.clear();
  registerCustomExercises([]);
  seed(richState());
  addonsPref.set([]);
});
afterEach(() => {
  addonsPref.reset();
  cleanup();
  vi.useRealTimers();
});

describe('no Equipment words without the module', () => {
  it('has words to look for in every locale', () => {
    for (const loc of LOCS) expect(words(loc).length).toBeGreaterThan(4);
  });
  it.each(LOCS)('gym page · %s', (loc) => {
    setLocale(loc);
    render(<GymDetailView gymId="g1" shell={makeShell()} onClose={() => {}} />);
    const text = document.body.textContent ?? '';
    for (const w of words(loc)) expect(text, w).not.toContain(w);
  });
  it.each(LOCS)('exercise page · %s', (loc) => {
    setLocale(loc);
    render(
      <ExerciseDetailView
        name="Barbell Bench Press - Medium Grip"
        shell={makeShell()}
        onClose={() => {}}
      />,
    );
    const text = document.body.textContent ?? '';
    for (const w of words(loc)) expect(text, w).not.toContain(w);
  });
  it.each(LOCS)('live session at a gym with an inventory · %s', (loc) => {
    setLocale(loc);
    const base = __getStateForTests();
    const now = Date.now();
    __replaceStateForTests({
      ...base,
      gyms: [
        {
          id: 'g1',
          name: 'Iron Yard',
          lat: 1,
          lng: 1,
          createdAt: now,
          inventory: ['dumbbell'],
          equipment: ['dumbbell'],
        } as never,
      ],
      workouts: [
        {
          id: 'live',
          startedAt: now - 600000,
          finishedAt: null,
          autoFinished: false,
          gymId: 'g1',
          exercises: [
            {
              id: 'e1',
              name: 'Barbell Bench Press - Medium Grip',
              kind: 'strength',
              position: 0,
              sets: [],
            },
            { id: 'e2', name: 'Barbell Squat', kind: 'strength', position: 1, sets: [] },
          ],
        },
      ],
    });
    render(<SessionView workoutId="live" shell={makeShell()} onClose={() => {}} />);
    const text = document.body.textContent ?? '';
    expect(text.length).toBeGreaterThan(50);
    for (const w of words(loc)) expect(text, w).not.toContain(w);
  });
});
