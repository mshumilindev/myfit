import { describe, expect, it } from 'vitest';
import { LANDMARKS, classifyZone, volumeHeatColors, weeklyMuscleSets } from './volume';
import { recentLoadSets, RECOVERY_DAYS, LOAD_HALF_LIFE_RECOVERY } from './loadWindow';
import * as recovery from './recovery';
import type { Workout } from './types';

const DAY = 24 * 3600 * 1000;
const now = Date.UTC(2026, 9, 15, 12);
const chestDay = (startedAt: number, n: number) =>
  ({
    id: `w${startedAt}`,
    startedAt,
    finishedAt: startedAt + 3600_000,
    exercises: [
      {
        id: 'e',
        name: 'Barbell Bench Press - Medium Grip',
        position: 0,
        kind: 'strength',
        sets: Array.from({ length: n }, (_, i) => ({
          id: `s${i}`,
          position: i,
          reps: 8,
          weight: 80,
          type: 'working',
        })),
      },
    ],
  }) as unknown as Workout;

describe('one shared load window (SPO-114)', () => {
  it('recovery.ts re-exports the very same function and constants', () => {
    expect(recovery.recentLoadSets).toBe(recentLoadSets);
    expect(recovery.RECOVERY_DAYS).toBe(RECOVERY_DAYS);
    expect(recovery.LOAD_HALF_LIFE_RECOVERY).toBe(LOAD_HALF_LIFE_RECOVERY);
  });

  it('a steady weekly dose reads as that dose (same scale as the landmarks)', () => {
    const ws = Array.from({ length: 8 }, (_, w) => chestDay(now - (w * 7 + 0.001) * DAY, 12));
    expect(recentLoadSets(ws, now).get('chest')!).toBeGreaterThan(10);
    expect(recentLoadSets(ws, now).get('chest')!).toBeLessThan(14);
  });

  it('ignores sessions in the future and older than the lookback', () => {
    const ws = [chestDay(now + DAY, 12), chestDay(now - 40 * DAY, 12)];
    expect(recentLoadSets(ws, now).size).toBe(0);
  });

  it('the 7-day volume heat map paints the same zone as classifyZone(recentLoadSets)', () => {
    const lm = LANDMARKS.chest!;
    for (const [days, n] of [
      [0.05, 24],
      [7, 24],
      [3, 12],
      [10, 30],
    ] as const) {
      const ws = [chestDay(now - days * DAY, n)];
      const load = recentLoadSets(ws, now).get('chest') ?? 0;
      const heat = volumeHeatColors(ws, now, 'fine', 7).chest;
      const zone = classifyZone(load, lm);
      if (zone === 'none') expect(heat).toBeUndefined();
      else
        expect(heat).toBe(
          {
            none: '',
            under: 'var(--color-neutral-600)',
            productive: 'var(--color-ok)',
            high: 'var(--color-accent)',
            over: 'var(--color-danger)',
          }[zone],
        );
    }
  });

  it('chest untrained for a week after one big day is not over (the SPO-114 bug)', () => {
    const ws = [chestDay(now - 7 * DAY, 24)];
    const heat = volumeHeatColors(ws, now, 'fine', 7).chest;
    expect(heat).not.toBe('var(--color-danger)');
  });
});

// Spike (SPO-114): rolling 7-day sum vs smooth decay on four lifter profiles.
// Zones differ exactly where the old window was wrong: a heavy day exactly a week
// ago (cliff), and a one-off spike (instant "over").
describe('spike: rolling window vs smooth decay', () => {
  const lm = LANDMARKS.chest!;
  const zones = (ws: Workout[]) => ({
    rolling: classifyZone(weeklyMuscleSets(ws, now, 7).get('chest') ?? 0, lm),
    smooth: classifyZone(recentLoadSets(ws, now).get('chest') ?? 0, lm),
  });
  it('steady lifter (2x8/week): neither model calls it over or empty', () => {
    const ws = [1, 4, 8, 11].map((d) => chestDay(now - d * DAY, 8));
    const z = zones(ws);
    for (const v of [z.rolling, z.smooth]) expect(['productive', 'high']).toContain(v);
  });
  it('one 24-set day yesterday: rolling says over, smooth does not', () => {
    const z = zones([chestDay(now - 1 * DAY, 24)]);
    expect(z.rolling).toBe('over');
    expect(z.smooth).not.toBe('over');
  });
  it('the same day 6.9 days ago: rolling still over, smooth already below the limit', () => {
    const z = zones([chestDay(now - 6.9 * DAY, 24)]);
    expect(z.rolling).toBe('over');
    expect(z.smooth).not.toBe('over');
  });
  it('returning after a month off: both read none/under', () => {
    const z = zones([chestDay(now - 30 * DAY, 12)]);
    expect(['none', 'under']).toContain(z.smooth);
    expect(z.rolling).toBe('none');
  });
});
