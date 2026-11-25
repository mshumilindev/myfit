/** Trainer days are judged against every cycle week, not only the base week. */
import { afterEach, describe, expect, it } from 'vitest';
import { addonsPref } from '../../../addons/enabledSet';
import { periodizationHost } from '../../../periodizationApi';
import { activeWeekPlan } from '../../../periodization/cycle';
import { freshProgram, type Program, type ProgramItem } from '../../../views/programs/model';
import { trainingDaysOfAnyWeek } from './AssignmentCard';

const row = (day: number): ProgramItem => ({
  id: `r${day}`,
  day,
  position: 0,
  name: 'Squat',
  kind: 'strength',
  sets: 3,
  reps: 5,
  durationMin: null,
  equipment: [],
});
const program = (): Program => ({
  ...freshProgram('P'),
  id: 'p',
  dayNames: { '1': 'A' },
  items: [row(1)],
  cycle: { length: 3, weeks: [{ dayNames: { '3': 'B' }, targetMuscles: {}, items: [row(3)] }] },
});

afterEach(() => {
  addonsPref.reset();
  periodizationHost.weekPlan = null;
});

describe('trainingDaysOfAnyWeek', () => {
  it('Periodization live: the days of every cycle week', () => {
    addonsPref.set(['periodization']);
    periodizationHost.weekPlan = activeWeekPlan as never;
    expect([...trainingDaysOfAnyWeek(program())].sort()).toEqual([1, 3]);
  });
  it('module off: only the base week (cycle data stays stored, unseen)', () => {
    expect([...trainingDaysOfAnyWeek(program())]).toEqual([1]);
  });
});
