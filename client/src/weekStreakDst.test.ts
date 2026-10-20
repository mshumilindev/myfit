import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeFeats } from './feats';
import { computeTrends } from './trends';
import { LOCALES, setLocale } from './i18n';
import { shiftWeeks } from './weekStart';
import type { BodyMetrics, Workout } from './types';

/**
 * The weekly streak must count calendar weeks. Stepping back in 7 x 24 h blocks from a local week start misses the
 * week start when a daylight-saving change falls inside the run (SPO-152): four Monday workouts across the autumn
 * change gave 28 days in UTC but 14 in Europe/Kyiv and 7 in America/Los_Angeles.
 */
const ZONES = [
  'UTC',
  'Europe/Kyiv',
  'America/Los_Angeles',
  'Pacific/Auckland',
  'Australia/Lord_Howe',
];

const L = (y: number, m: number, d: number, h = 12): number => new Date(y, m - 1, d, h).getTime();
const wk = (startedAt: number, i: number): Workout =>
  ({
    id: `w${i}`,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    autoFinished: false,
    exercises: [],
  }) as unknown as Workout;
const mondays = (): Workout[] =>
  [L(2026, 10, 12), L(2026, 10, 19), L(2026, 10, 26), L(2026, 11, 2)].map(wk);
const noBody = { weights: [] } as unknown as BodyMetrics;

describe.each(ZONES)('weekly streak across a DST change in %s', (zone) => {
  let before: string | undefined;
  beforeEach(() => {
    before = process.env.TZ;
    process.env.TZ = zone;
    setLocale('en');
  });
  afterEach(() => {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  });

  it('feats: four consecutive Monday weeks are a 28-day streak', () => {
    const r = computeFeats(mondays());
    expect(r.byGroup.streak[0].value).toBe(28);
  });

  it('trends: the streak tip counts the same four weeks', () => {
    const now = L(2026, 11, 4);
    const tip = computeTrends(mondays(), noBody, now).insights.find((i) => i.key === 'streak');
    expect(tip?.headline).toBe(LOCALES.en.trends.streak(4));
  });
});

describe('shiftWeeks', () => {
  let before: string | undefined;
  beforeEach(() => {
    before = process.env.TZ;
    process.env.TZ = 'Europe/Kyiv';
  });
  afterEach(() => {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  });

  it('moves a local week start by whole calendar weeks, across a DST change', () => {
    const mon = L(2026, 10, 26, 0);
    expect(shiftWeeks(mon, -1)).toBe(L(2026, 10, 19, 0));
    expect(shiftWeeks(mon, 1)).toBe(L(2026, 11, 2, 0));
    expect(shiftWeeks(mon, 0)).toBe(mon);
  });
});
