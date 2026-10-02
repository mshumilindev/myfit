/**
 * Supplement protein in Nutrition › Today: it is added to the day's EATEN protein (the macro
 * bar) only on days the supplements count, never to calories, with a small hint that it is
 * counted apart from the food log. Off (master, the protein switch, no entries) = no change.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
  state: {
    authReady: true,
    uid: 'u1',
    username: 'Test',
    role: 'member',
    loading: false,
    failed: false,
    online: true,
    lang: 'en',
    entries: [] as unknown[],
    customFoods: [],
    goal: { type: 'maintain', target: { kcal: 2400, protein: 150, fat: 80, carbs: 280 } },
    profile: null,
    spotterBody: null,
  },
}));
vi.mock('./store', () => ({
  useStore: () => h.state,
  store: { retry: vi.fn(), setLang: vi.fn() },
  entriesForDay: (s: { entries: { day: string }[] }, d: string) =>
    s.entries.filter((e) => e.day === d),
}));

import { SupplementProteinHint, useSupplementProtein } from './supplementProtein';
import { TodayView } from './views';
import { __getStateForTests, __replaceStateForTests } from '../store';
import {
  defaultSupplementSettings,
  emptySupplementState,
  newSupplementEntry,
} from '../supplements';
import type { SupplementCheckin, SupplementEntry, SupplementId, Workout } from '../types';

const NOW = new Date(2026, 9, 7, 12).getTime(); // Wednesday
const DAY = '2026-10-07';
const T0 = new Date(2026, 8, 1, 10).getTime();
const ent = (id: SupplementId, over: Partial<SupplementEntry> = {}): SupplementEntry => ({
  ...newSupplementEntry(id, `e-${id}`, T0),
  ...over,
});
const trained: Workout = {
  id: 'w',
  startedAt: new Date(2026, 9, 7, 8).getTime(),
  finishedAt: new Date(2026, 9, 7, 9).getTime(),
  autoFinished: false,
  gymId: null,
  exercises: [],
} as unknown as Workout;

function seed(
  entries: SupplementEntry[],
  opts: {
    master?: boolean;
    proteinSwitch?: boolean;
    workouts?: Workout[];
    checkins?: Record<string, SupplementCheckin>;
  } = {},
) {
  const settings = defaultSupplementSettings();
  settings.useInCalculations = opts.master ?? true;
  settings.surfaces.protein = opts.proteinSwitch ?? true;
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: opts.workouts ?? [],
    supplements: { entries, checkins: opts.checkins ?? {}, settings, updatedAt: 1 },
  });
}
const food = (protein: number) => ({
  id: 'f1',
  type: 'meal',
  name: 'Chicken',
  items: [],
  macros: { kcal: 500, protein, fat: 10, carbs: 20 },
  loggedAt: '2026-10-07T10:00:00',
  day: DAY,
});

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  h.state.entries = [food(40)];
  seed([]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: [],
    supplements: emptySupplementState(),
  });
});

describe('useSupplementProtein', () => {
  it('is 0 with nothing saved, the master off, or the protein switch off', () => {
    expect(renderHook(() => useSupplementProtein(DAY)).result.current).toBe(0);
    seed([ent('whey')], { master: false });
    expect(renderHook(() => useSupplementProtein(DAY)).result.current).toBe(0);
    seed([ent('whey')], { proteinSwitch: false });
    expect(renderHook(() => useSupplementProtein(DAY)).result.current).toBe(0);
  });

  it('adds the declared grams on days the entries count (daily vs training days)', () => {
    seed([ent('whey'), ent('casein', { schedule: 'trainingDays' })]);
    // Wednesday, no plan and no workout: a rest day, only the daily one.
    expect(renderHook(() => useSupplementProtein(DAY)).result.current).toBe(20);
    // A finished workout makes it a training day: both count (20 + 24 g).
    seed([ent('whey'), ent('casein', { schedule: 'trainingDays' })], { workouts: [trained] });
    expect(renderHook(() => useSupplementProtein(DAY)).result.current).toBe(44);
  });

  it('a "None" check-in takes the day away; "Some" keeps only the ticked entries', () => {
    seed([ent('whey'), ent('plantProtein')], { checkins: { [DAY]: { taken: false } } });
    expect(renderHook(() => useSupplementProtein(DAY)).result.current).toBe(0);
    seed([ent('whey'), ent('plantProtein')], {
      checkins: { [DAY]: { taken: true, entryIds: ['e-whey'] } },
    });
    expect(renderHook(() => useSupplementProtein(DAY)).result.current).toBe(20);
  });

  it('follows the store when the supplements change', () => {
    const { result } = renderHook(() => useSupplementProtein(DAY));
    expect(result.current).toBe(0);
    act(() => seed([ent('whey')]));
    expect(result.current).toBe(20);
  });
});

describe('SupplementProteinHint', () => {
  it('says how much, and that it is counted apart from food logging; nothing for 0', () => {
    const { container, rerender } = render(<SupplementProteinHint grams={0} />);
    expect(container.firstChild).toBeNull();
    rerender(<SupplementProteinHint grams={20} />);
    expect(screen.getByTestId('sup-protein-hint').textContent).toContain(
      'Includes 20 g from supplements, counted apart from your food log.',
    );
  });
});

describe('Nutrition › Today', () => {
  const proteinBar = (c: HTMLElement) => c.querySelector('.bar.p .val')!.textContent;
  const renderToday = () =>
    render(
      <TodayView onOpenEntry={() => undefined} onGoal={() => undefined} onAdd={() => undefined} />,
    );

  it('off: the protein bar shows food only and there is no hint', () => {
    const { container } = renderToday();
    expect(proteinBar(container)).toBe('40/150 g');
    expect(screen.queryByTestId('sup-protein-hint')).toBeNull();
  });

  it('on: the supplement protein counts toward the protein progress, calories stay food only', () => {
    seed([ent('whey')]);
    const { container } = renderToday();
    expect(proteinBar(container)).toBe('60/150 g');
    expect(screen.getByTestId('sup-protein-hint').textContent).toContain('20 g');
    expect(container.textContent).toContain('500 of 2400 kcal');
  });

  it('a rest day for a training-day entry: no extra protein, no hint', () => {
    seed([ent('casein', { schedule: 'trainingDays' })]);
    const { container } = renderToday();
    expect(proteinBar(container)).toBe('40/150 g');
    expect(screen.queryByTestId('sup-protein-hint')).toBeNull();
  });
});
