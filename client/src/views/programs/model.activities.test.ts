import { describe, expect, it } from 'vitest';
import {
  addActivity,
  copyDay,
  dayActivities,
  duplicateOf,
  freshProgram,
  normalizeProgram,
  patchActivity,
  removeActivity,
  sanitizeActivities,
  toSaved,
} from './model';

const base = () => ({ ...freshProgram('P'), dayNames: { '6': 'Sat' } });
const run = {
  day: 6,
  type: 'run',
  minutes: 20,
  effort: 'moderate' as const,
  when: 'after' as const,
};

describe('program activities', () => {
  it('adds, patches and removes an activity per weekday', () => {
    let p = addActivity(base(), run);
    expect(dayActivities(p, 6)).toHaveLength(1);
    expect(dayActivities(p, 1)).toHaveLength(0);
    p = patchActivity(p, p.activities![0].id, { minutes: 35 });
    expect(p.activities![0].minutes).toBe(35);
    p = removeActivity(p, p.activities![0].id);
    expect(p.activities).toEqual([]);
  });

  it('drops malformed entries and fills defaults', () => {
    const out = sanitizeActivities([
      { type: 'nope', day: 1, minutes: 10 },
      { type: 'run', day: 9, minutes: 10 },
      { type: 'run', day: 2, minutes: 0 },
      { type: 'yoga', day: 2, minutes: 30, effort: 'x', when: 'y' },
      'junk',
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'yoga', effort: 'moderate', when: 'any' });
    expect(sanitizeActivities(undefined)).toEqual([]);
  });

  it('is absent from a saved program that has none, kept when it has some', () => {
    expect('activities' in toSaved(base(), 'u', 'x')).toBe(false);
    expect(toSaved(addActivity(base(), run), 'u', 'x').activities).toHaveLength(1);
    expect(normalizeProgram(base()).activities).toBeUndefined();
  });

  it('copyDay copies activities with fresh ids; duplicateOf re-ids them', () => {
    const p = addActivity(base(), run);
    const c = copyDay(p, 6, 7);
    expect(dayActivities(c, 7)).toHaveLength(1);
    expect(dayActivities(c, 7)[0].id).not.toBe(p.activities![0].id);
    const d = duplicateOf(p, 'Copy');
    expect(d.activities![0].id).not.toBe(p.activities![0].id);
  });
});
