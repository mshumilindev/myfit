import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SupplementRpeNote, SupplementStrengthNote, SupplementTrendNote } from './SupplementNotes';
import { NicotineTrendNote } from './NicotineTrendNote';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { setLocale } from '../i18n';
import {
  defaultSupplementSettings,
  emptySupplementState,
  newSupplementEntry,
} from '../supplements';
import type { SupplementEntry, SupplementId, Workout } from '../types';

const NOW = new Date(2026, 9, 7, 12).getTime(); // Wednesday
const T0 = new Date(2026, 8, 1, 10).getTime();
const ent = (id: SupplementId, over: Partial<SupplementEntry> = {}): SupplementEntry => ({
  ...newSupplementEntry(id, `e-${id}`, T0),
  ...over,
});
const finished: Workout = {
  id: 'w',
  startedAt: new Date(2026, 9, 7, 8).getTime(),
  finishedAt: new Date(2026, 9, 7, 9).getTime(),
  autoFinished: false,
  gymId: null,
  exercises: [],
} as unknown as Workout;

function seed(entries: SupplementEntry[], master = true, off: string[] = []) {
  const settings = defaultSupplementSettings();
  settings.useInCalculations = master;
  for (const k of off) (settings.surfaces as Record<string, boolean>)[k] = false;
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: [finished],
    supplements: { entries, checkins: {}, settings, updatedAt: 1 },
  });
}

beforeEach(() => {
  setLocale('en');
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
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

describe('SupplementStrengthNote', () => {
  it('is an expectation only, with a range and "loads are not changed"', () => {
    seed([ent('creatine')]);
    render(<SupplementStrengthNote />);
    expect(screen.getByTestId('sup-strength-note').textContent).toMatch(
      /^Creatine: strength may rise about \+0–\d % over the next weeks \(study average\)\. Your loads are not changed\.$/,
    );
  });
  it('is gone with the master off, the strength switch off, or no creatine', () => {
    for (const [entries, master, off] of [
      [[ent('creatine')], false, []],
      [[ent('creatine')], true, ['strength']],
      [[ent('whey')], true, []],
      [[], true, []],
    ] as const) {
      seed([...entries], master, [...off]);
      expect(render(<SupplementStrengthNote />).container.firstChild).toBeNull();
      cleanup();
    }
  });
});

describe('SupplementRpeNote', () => {
  it('shows on a training day with a pre-workout dose', () => {
    seed([ent('caffeine', { dose: 200 })]);
    render(<SupplementRpeNote />);
    expect(screen.getByTestId('sup-rpe-note').textContent).toContain('0.2–0.5 RPE easier');
  });
  it('is gone with the effort switch off, a morning-only dose, or a rest day', () => {
    seed([ent('caffeine', { dose: 200 })], true, ['rpe']);
    expect(render(<SupplementRpeNote />).container.firstChild).toBeNull();
    cleanup();
    seed([ent('caffeine', { dose: 200, timing: 'morning' })]);
    expect(render(<SupplementRpeNote />).container.firstChild).toBeNull();
    cleanup();
    seed([ent('caffeine', { dose: 200 })]);
    __replaceStateForTests({ ...__getStateForTests(), workouts: [] });
    vi.setSystemTime(new Date(2026, 9, 8, 12).getTime()); // Thursday, no plan, no habit
    expect(render(<SupplementRpeNote />).container.firstChild).toBeNull();
  });
});

describe('Progress trend note', () => {
  it('mentions supplements only while late caffeine adds to the sleep need', () => {
    seed([ent('caffeine', { timing: 'evening', schedule: 'daily', dose: 400 })]);
    render(<SupplementTrendNote />);
    expect(screen.getByTestId('sup-trend-note').textContent).toMatch(/late caffeine/);
    cleanup();
    seed([ent('creatine')]);
    expect(render(<SupplementTrendNote />).container.firstChild).toBeNull();
  });
  it('the shared Progress note shows nothing with nothing in use, and keeps its old text', () => {
    seed([]);
    expect(render(<NicotineTrendNote />).container.firstChild).toBeNull();
    cleanup();
    seed([ent('caffeine', { timing: 'evening', schedule: 'daily', dose: 400 })]);
    render(<NicotineTrendNote />);
    expect(screen.getByTestId('sup-trend-note')).toBeTruthy();
  });
});
