/** Planned sessions of a program with a weekly cycle (SPO-609): what "expected so far" is measured against. */
import { describe, expect, it } from 'vitest';
import {
  plannedInWeek,
  plannedThrough,
  type CycledProgram,
} from '../../functions/src/programCycle';

const it1 = (day: number) => ({ day, name: 'Squat' });
const plain: CycledProgram = { daysPerWeek: 3, items: [it1(1), it1(3), it1(5)] };
const cycled: CycledProgram = {
  ...plain,
  cycle: {
    length: 3,
    weeks: [
      { items: [it1(1), it1(3), it1(5), it1(6)] }, // cycle week 2: four days
      { items: [it1(2)] }, // cycle week 3: a deload with one day
    ],
  },
};

describe('planned sessions', () => {
  it('without a cycle: days per week, as before', () => {
    expect(plannedInWeek(plain, 4)).toBe(3);
    expect(plannedThrough(plain, 4)).toBe(12);
    expect(plannedThrough(plain, 0)).toBe(0);
  });
  it('with a cycle: the days of each real week, repeating', () => {
    expect([1, 2, 3, 4, 5, 6].map((w) => plannedInWeek(cycled, w))).toEqual([3, 4, 1, 3, 4, 1]);
    expect(plannedThrough(cycled, 3)).toBe(8);
    expect(plannedThrough(cycled, 6)).toBe(16);
  });
  it('a deload week lowers what is expected, so it is not counted as missed', () => {
    expect(plannedThrough(cycled, 3) - plannedThrough(cycled, 2)).toBe(1);
  });
  it('target-muscle, row and day-name days count; a missing week is the base week', () => {
    const muscles: CycledProgram = {
      daysPerWeek: 2,
      items: [{ day: 1, name: 'Squat' }],
      cycle: {
        length: 3,
        weeks: [
          {
            targetMuscles: { '2': ['chest'], '4': [] },
            items: [{ day: 4, name: ' ' }],
            dayNames: { '6': 'Arms', '7': ' ' },
          },
        ],
      },
    };
    expect(plannedInWeek(muscles, 2)).toBe(3); // day 2 (muscles), day 4 (a row), day 6 (a name)
    expect(plannedInWeek(muscles, 3)).toBe(1); // week 3 missing: the base week
    expect(plannedInWeek({ daysPerWeek: 4, items: [], cycle: { length: 1 } }, 2)).toBe(4);
  });
  it('a cycle longer than 12 is cut to 12, like the client', () => {
    const long: CycledProgram = {
      daysPerWeek: 3,
      items: [it1(1)],
      cycle: { length: 15, weeks: [] },
    };
    expect(plannedInWeek(long, 13)).toBe(plannedInWeek(long, 1));
  });
});
