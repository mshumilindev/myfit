import { describe, expect, it } from 'vitest';
import type { Activity } from './types';
import {
  isMuted,
  mutedTypes,
  pruneSnoozes,
  snoozeKey,
  suggestForProgram,
  MUTE_ALL,
} from './programSuggest';
import { weekStartOf } from './weekStart';

const DAY = 24 * 3600 * 1000;
// Wednesday 2026-09-30, noon local.
const now = new Date(2026, 8, 30, 12).getTime();
const monday = weekStartOf(now, 1);

/** A Saturday `back` weeks ago (back ≥ 1). */
const sat = (back: number, type = 'padel', min = 75): Activity => ({
  id: `${type}${back}`,
  type,
  category: 'conditioning',
  startedAt: monday - back * 7 * DAY + 5 * DAY + 10 * 3600 * 1000,
  finishedAt: monday - back * 7 * DAY + 5 * DAY + 10 * 3600 * 1000 + min * 60000,
  durationMin: min,
});
const run = (over: Partial<Parameters<typeof suggestForProgram>[0]> = {}) =>
  suggestForProgram({ activities: [], planned: [], off: [], now, weekStart: 1, ...over });

describe('suggestForProgram', () => {
  it('suggests an activity done on the same weekday in ≥4 of the last 6 weeks', () => {
    const s = run({ activities: [1, 2, 3, 5].map((b) => sat(b)) });
    expect(s).toMatchObject({ type: 'padel', weekday: 6, minutes: 75, weeks: 4, of: 6 });
  });

  it('stays quiet below the threshold, for live or too-old activities', () => {
    expect(run({ activities: [1, 2, 3].map((b) => sat(b)) })).toBeNull();
    expect(run({ activities: [1, 2, 3, 7].map((b) => sat(b)) })).toBeNull();
    const live = { ...sat(4), finishedAt: null };
    expect(run({ activities: [1, 2, 3].map((b) => sat(b)).concat(live) })).toBeNull();
  });

  it('skips what the program already plans on that day', () => {
    const acts = [1, 2, 3, 4].map((b) => sat(b));
    const planned = [
      {
        id: 'x',
        day: 6,
        type: 'padel',
        minutes: 60,
        effort: 'moderate' as const,
        when: 'any' as const,
      },
    ];
    expect(run({ activities: acts, planned })).toBeNull();
    expect(run({ activities: acts, planned: [{ ...planned[0], day: 7 }] })).not.toBeNull();
  });

  it('honours never / snooze / stop-all', () => {
    const acts = [1, 2, 3, 4].map((b) => sat(b));
    expect(run({ activities: acts, off: ['padel'] })).toBeNull();
    expect(run({ activities: acts, off: [MUTE_ALL] })).toBeNull();
    expect(run({ activities: acts, off: [snoozeKey('padel', now + DAY)] })).toBeNull();
    expect(run({ activities: acts, off: [snoozeKey('padel', now - DAY)] })).not.toBeNull();
  });

  it('prefers the most consistent activity', () => {
    const acts = [
      ...[1, 2, 3, 4].map((b) => sat(b)),
      ...[1, 2, 3, 4, 5].map((b) => sat(b, 'run', 30)),
    ];
    expect(run({ activities: acts })?.type).toBe('run');
  });
});

describe('mute list helpers', () => {
  it('tells permanent mutes from snoozes and prunes expired ones', () => {
    const off = ['padel', MUTE_ALL, snoozeKey('run', now + DAY), snoozeKey('yoga', now - DAY)];
    expect(mutedTypes(off)).toEqual(['padel']);
    expect(pruneSnoozes(off, now)).toEqual(['padel', MUTE_ALL, snoozeKey('run', now + DAY)]);
    expect(isMuted(off, 'run', now)).toBe(true);
    expect(isMuted(['padel', snoozeKey('yoga', now - DAY)], 'yoga', now)).toBe(false);
    expect(isMuted(off, 'yoga', now)).toBe(true); // stop-all wins
  });
});
