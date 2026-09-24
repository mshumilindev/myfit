import { describe, expect, it } from 'vitest';
import { parseRange, parseWeekdays } from './when';
import { normalize, tokens } from './nlu';
import { memoryBuildHints, SORE_CAP } from './memoryPlan';

const NOW = new Date(2026, 8, 23, 12).getTime(); // Wed 23 Sep 2026
const r = (q: string) => parseRange(normalize(q), NOW);
const DAY = 86_400_000;

describe('parseRange', () => {
  it('rolling windows', () => {
    expect(Math.round((NOW - r('last 3 months')!.from) / DAY)).toBe(91);
    expect(r('за останні 2 тижні')!.label[1]).toBe('останні 2 тижні');
    expect(r('past 10 days')!.from).toBe(NOW - 10 * DAY);
  });
  it('calendar windows', () => {
    expect(new Date(r('this month')!.from).getDate()).toBe(1);
    expect(new Date(r('минулого тижня')!.from).getDay()).toBe(1);
    expect(new Date(r('last year')!.from).getFullYear()).toBe(2025);
  });
  it('months and "ago"', () => {
    expect(new Date(r('since June')!.from).getMonth()).toBe(5);
    expect(r('з червня')!.label[0]).toBe('since June');
    expect(new Date(r('у серпні')!.to).getMonth()).toBe(8);
    expect(r('3 months ago')!.ago).toBe(true);
  });
  it('ignores look-alikes', () => {
    expect(r('may I train today')).toBeNull();
    expect(r('травма коліна')).toBeNull();
    expect(r('груди і плечі')).toBeNull();
    expect(r('decline bench')).toBeNull();
    expect(r('how many days a week should I train')).toBeNull();
  });
});

describe('parseWeekdays', () => {
  it('reads weekdays in several languages', () => {
    expect(parseWeekdays(tokens('move legs to Thursday'))).toEqual([4]);
    expect(parseWeekdays(tokens('перенеси з понеділка на пʼятницю'))).toEqual([1, 5]);
  });
});

describe('memory → plan', () => {
  it('sore parts make their muscles lighter; bans and swaps reach the builder', () => {
    const h = memoryBuildHints(
      { sore: { knee: NOW - DAY }, avoid: ['Dumbbell Lunges'], prefer: [{ from: 'A', to: 'B' }] },
      new Map(),
      NOW,
    );
    expect(h.loadCaps.get('quads')).toBe(SORE_CAP);
    expect(h.avoid).toEqual(['Dumbbell Lunges', 'A']);
    expect(h.prefer).toEqual(['B']);
  });
  it('forgets soreness after two weeks', () => {
    const h = memoryBuildHints({ sore: { knee: NOW - 15 * DAY } }, new Map(), NOW);
    expect(h.loadCaps.size).toBe(0);
  });
});
