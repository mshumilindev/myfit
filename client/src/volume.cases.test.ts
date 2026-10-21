import { describe, expect, it } from 'vitest';
import {
  LANDMARKS,
  classifyZone,
  VOLUME_MUSCLES,
  VOLUME_ZONES,
  ZONE_COLOR,
  historyAgeDays,
  scaleLandmark,
  volumeHeatColors,
  weeklyMuscleSets,
  zoneLandmark,
  zoneSets,
} from './volume';
import type { Landmark } from './volume';
import type { MuscleGroup } from './data/exercises';
import type { Workout } from './types';

const DAY = 24 * 3600 * 1000;
const NOW = Date.UTC(2026, 9, 15, 12);

/** One strength exercise with explicit muscles (no catalog dependence). */
function session(
  startedAt: number,
  sets: number,
  primary: string,
  secondary: string[] = [],
): Workout {
  return {
    id: `w${startedAt}-${primary}`,
    startedAt,
    finishedAt: startedAt + 3600_000,
    autoFinished: false,
    exercises: [
      {
        id: 'e1',
        name: 'Custom move',
        kind: 'strength',
        position: 0,
        primaryMuscle: primary,
        secondaryMuscles: secondary,
        sets: Array.from({ length: sets }, (_, i) => ({
          id: `s${i}`,
          position: i,
          reps: 8,
          weight: 50,
          type: 'working',
        })),
      },
    ],
  } as unknown as Workout;
}

describe('landmark tables', () => {
  it('every landmarked muscle has ordered mev <= mav <= mrv', () => {
    for (const m of VOLUME_MUSCLES) {
      const lm = LANDMARKS[m]!;
      expect(lm.mev).toBeLessThanOrEqual(lm.mav);
      expect(lm.mav).toBeLessThanOrEqual(lm.mrv);
    }
  });

  it('zones only contain landmarked muscles and cover each fine muscle once', () => {
    const all = VOLUME_ZONES.flatMap((z) => z.members);
    expect(all.sort()).toEqual([...VOLUME_MUSCLES].sort());
  });
});

describe('classifyZone', () => {
  const lm: Landmark = { mev: 6, mav: 12, mrv: 20 };
  it('no sets is "none", a negative count too', () => {
    expect(classifyZone(0, lm)).toBe('none');
    expect(classifyZone(-1, lm)).toBe('none');
  });
  it('MEV is the first productive set count; just below it is under', () => {
    expect(classifyZone(0.5, lm)).toBe('under');
    expect(classifyZone(5.9, lm)).toBe('under');
    expect(classifyZone(6, lm)).toBe('productive');
    expect(classifyZone(11.9, lm)).toBe('productive');
  });
  it('MAV starts the high zone, MRV itself is still high, above MRV is over', () => {
    expect(classifyZone(12, lm)).toBe('high');
    expect(classifyZone(20, lm)).toBe('high');
    expect(classifyZone(20.1, lm)).toBe('over');
  });
  it('core has MEV 0: any set at all is already productive', () => {
    expect(classifyZone(0.5, LANDMARKS.core!)).toBe('productive');
  });
});

describe('zoneLandmark', () => {
  it('sums member landmarks (arms = biceps + triceps + forearms)', () => {
    expect(zoneLandmark(['biceps', 'triceps', 'forearms'])).toEqual({ mev: 17, mav: 32, mrv: 52 });
  });

  it('skips muscles without a landmark and returns zeros for an empty list', () => {
    expect(zoneLandmark(['adductors', 'neck'])).toEqual({ mev: 0, mav: 0, mrv: 0 });
    expect(zoneLandmark([])).toEqual({ mev: 0, mav: 0, mrv: 0 });
    expect(zoneLandmark(['chest', 'adductors'])).toEqual(LANDMARKS.chest);
  });
});

describe('scaleLandmark', () => {
  const lm: Landmark = { mev: 6, mav: 12, mrv: 20 };
  it('one week returns the landmark unchanged (same reference)', () => {
    expect(scaleLandmark(lm, 1)).toBe(lm);
  });
  it('multiplies every threshold by the number of weeks', () => {
    expect(scaleLandmark(lm, 4)).toEqual({ mev: 24, mav: 48, mrv: 80 });
    expect(scaleLandmark(lm, 0.5)).toEqual({ mev: 3, mav: 6, mrv: 10 });
  });
});

describe('weeklyMuscleSets', () => {
  it('counts primary sets fully and secondary at half weight, summed over sessions', () => {
    const per = weeklyMuscleSets(
      [session(NOW - DAY, 4, 'chest', ['triceps']), session(NOW - 2 * DAY, 3, 'chest')],
      NOW,
    );
    expect(per.get('chest')).toBe(7);
    expect(per.get('triceps')).toBe(2);
  });

  it('honours a custom window length', () => {
    const w = session(NOW - 10 * DAY, 5, 'lats');
    expect(weeklyMuscleSets([w], NOW).get('lats')).toBeUndefined();
    expect(weeklyMuscleSets([w], NOW, 14).get('lats')).toBe(5);
  });

  it('a session exactly one window old counts, one millisecond older does not', () => {
    const edge = session(NOW - 7 * DAY, 4, 'lats');
    const old = session(NOW - 7 * DAY - 1, 4, 'lats');
    expect(weeklyMuscleSets([edge], NOW).get('lats')).toBe(4);
    expect(weeklyMuscleSets([old], NOW).get('lats')).toBeUndefined();
  });

  it('returns an empty map for no history', () => {
    expect(weeklyMuscleSets([], NOW).size).toBe(0);
  });
});

describe('zoneSets', () => {
  it('sums the members present and treats absent members as zero', () => {
    const per = new Map<MuscleGroup, number>([
      ['lats', 5],
      ['traps', 2.5],
    ]);
    expect(zoneSets(per, ['lats', 'traps', 'lower_back'])).toBe(7.5);
    expect(zoneSets(per, [])).toBe(0);
  });
});

describe('historyAgeDays', () => {
  it('is the age of the earliest session in days', () => {
    const fin = [session(NOW - 3 * DAY, 1, 'chest'), session(NOW - 10.5 * DAY, 1, 'chest')];
    expect(historyAgeDays(fin, NOW)).toBe(10.5);
  });

  it('is 0 with no history', () => {
    expect(historyAgeDays([], NOW)).toBe(0);
  });

  it('is 0 when the only session is in the future (clamped by earliest = now)', () => {
    expect(historyAgeDays([session(NOW + DAY, 1, 'chest')], NOW)).toBe(0);
  });
});

describe('ZONE_COLOR', () => {
  it('maps each zone to a distinct design token', () => {
    const vals = Object.values(ZONE_COLOR);
    expect(new Set(vals).size).toBe(5);
    expect(ZONE_COLOR.over).toBe('var(--color-danger)');
    expect(ZONE_COLOR.productive).toBe('var(--color-ok)');
  });
});

describe('volumeHeatColors (28-day historical window, scaled landmarks x4)', () => {
  // chest 8/14/22 x4 = 32/56/88
  it('fine grain paints each trained muscle by its own zone', () => {
    const colors = volumeHeatColors([session(NOW - DAY, 40, 'chest')], NOW, 'fine', 28);
    expect(colors).toEqual({ chest: ZONE_COLOR.productive });
  });

  it('fine grain marks over-the-ceiling volume as over and below MEV as under', () => {
    expect(volumeHeatColors([session(NOW - DAY, 90, 'chest')], NOW, 'fine', 28).chest).toBe(
      ZONE_COLOR.over,
    );
    expect(volumeHeatColors([session(NOW - DAY, 20, 'chest')], NOW, 'fine', 28).chest).toBe(
      ZONE_COLOR.under,
    );
  });

  it('leaves untrained muscles out entirely', () => {
    expect(volumeHeatColors([], NOW, 'fine', 28)).toEqual({});
    expect(volumeHeatColors([], NOW, 'zones', 28)).toEqual({});
  });

  it('zones grain paints every member of a zone with the zone aggregate colour', () => {
    // back = lats+traps+lower_back: mev 20 mav 36 mrv 54 -> x4 = 80/144/216. 90 lats -> productive.
    const colors = volumeHeatColors([session(NOW - DAY, 90, 'lats')], NOW, 'zones', 28);
    expect(colors).toEqual({
      lats: ZONE_COLOR.productive,
      traps: ZONE_COLOR.productive,
      lower_back: ZONE_COLOR.productive,
    });
  });

  it('per-user landmarks override the base table (fine grain)', () => {
    const custom = new Map<MuscleGroup, Landmark>([['chest', { mev: 1, mav: 2, mrv: 3 }]]);
    // 40 sets vs x4 -> 4/8/12 -> over
    const colors = volumeHeatColors([session(NOW - DAY, 40, 'chest')], NOW, 'fine', 28, custom);
    expect(colors.chest).toBe(ZONE_COLOR.over);
  });

  it('per-user landmarks: muscles absent from the map fall back to the base table', () => {
    const custom = new Map<MuscleGroup, Landmark>([['triceps', { mev: 1, mav: 2, mrv: 3 }]]);
    const colors = volumeHeatColors([session(NOW - DAY, 40, 'chest')], NOW, 'fine', 28, custom);
    expect(colors.chest).toBe(ZONE_COLOR.productive);
  });

  it('per-user landmarks are summed per zone, falling back per member (zones grain)', () => {
    // arms: biceps custom 1/2/3 + triceps 6/12/18 + forearms 5/8/14 = 12/22/35, x4 = 48/88/140.
    const custom = new Map<MuscleGroup, Landmark>([['biceps', { mev: 1, mav: 2, mrv: 3 }]]);
    const colors = volumeHeatColors([session(NOW - DAY, 100, 'biceps')], NOW, 'zones', 28, custom);
    expect(colors.biceps).toBe(ZONE_COLOR.high);
    expect(colors.triceps).toBe(ZONE_COLOR.high);
    expect(colors.forearms).toBe(ZONE_COLOR.high);
    // Base arms 17/32/52 x4 = 68/128/208: the same 100 sets are only productive.
    const base = volumeHeatColors([session(NOW - DAY, 100, 'biceps')], NOW, 'zones', 28);
    expect(base.biceps).toBe(ZONE_COLOR.productive);
  });

  it('per-user landmark map skipping a member with no landmark at all', () => {
    // neck-only zone members do not exist; assert muscles w/o base landmark are never painted.
    const colors = volumeHeatColors([session(NOW - DAY, 10, 'neck')], NOW, 'fine', 28);
    expect(colors).toEqual({});
  });

  it('7-day grain uses the fading recent load: today reads higher than the same day 3 weeks ago', () => {
    const today = volumeHeatColors([session(NOW, 12, 'chest')], NOW, 'fine');
    const old = volumeHeatColors([session(NOW - 21 * DAY, 12, 'chest')], NOW, 'fine');
    // 12 sets fresh ~8.7 weekly-equivalent (>= mev 8); 3 weeks later it has faded below MEV.
    expect(today.chest).toBe(ZONE_COLOR.productive);
    expect(old.chest).toBe(ZONE_COLOR.under);
  });
});
