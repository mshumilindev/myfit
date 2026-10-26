import { describe, expect, it } from 'vitest';
import { muscleFatigue, stalledMuscles } from './fatigue';
import type { Exercise, SetEntry, Workout } from './types';

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 26, 12);

const set = (weight: number | null = 60, reps = 8): SetEntry => ({
  id: Math.random().toString(36).slice(2),
  reps,
  weight,
  isWarmup: false,
  position: 0,
  loggedAt: NOW,
});
const ex = (name: string, n: number, weight = 60): Exercise => ({
  id: `${name}-${n}`,
  name,
  position: 0,
  sets: Array.from({ length: n }, () => set(weight)),
});
const wk = (id: string, startedAt: number, exercises: Exercise[]): Workout => ({
  id,
  startedAt,
  finishedAt: startedAt + 3600000,
  autoFinished: false,
  exercises,
});

const PRESS = 'Barbell Bench Press - Medium Grip';

/** Same lift, same top weight, `n` sessions ending `lastDaysAgo` days before NOW (a flat/stalled lift). */
function flatLift(lastDaysAgo: number, n = 4, sets = 3): Workout[] {
  return Array.from({ length: n }, (_, i) =>
    wk(`w${i}`, NOW - (lastDaysAgo + i * 3) * DAY, [ex(PRESS, sets, 60)]),
  );
}

describe('SPO-352: a muscle with no sets this week is never "high"', () => {
  it("owner's scenario: stalled lift, last session 9 days ago, 0 sets this week -> fresh", () => {
    const history = flatLift(9);
    expect(stalledMuscles(history, NOW).has('chest')).toBe(true);
    const chest = muscleFatigue(history, NOW).get('chest');
    expect(chest?.sets).toBe(0);
    expect(chest?.level).toBe('fresh');
    expect(chest?.score).toBeLessThan(0.15);
  });

  it('no history at all -> every muscle fresh', () => {
    for (const f of muscleFatigue([], NOW).values()) expect(f.level).toBe('fresh');
  });
});

import { deloadSuggestion } from './fatigue';
import { fatigueWhy } from './fatigueWhy';
import { setWeekStartDay } from './weekStart';
import { LANDMARKS, VOLUME_MUSCLES } from './volume';
import { readinessMood, muscleReadiness as muscleReadinessOf } from './recovery';
import { fatigueByGroup, groupFatigueLevel, familyFatigueLevel, FAMILIES } from './picker';

const lvlRank = { fresh: 0, moderate: 1, high: 2, fried: 3 } as const;

/** Deterministic PRNG (mulberry32): property cases are reproducible, no extra dependency. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LIFTS = [
  PRESS,
  'Barbell Squat',
  'Pullups',
  'Barbell Curl',
  'Standing Military Press',
  'Barbell Deadlift',
];

function randomHistory(r: () => number): Workout[] {
  const n = 1 + Math.floor(r() * 12);
  const out: Workout[] = [];
  for (let i = 0; i < n; i++) {
    const ago = r() * 40;
    const lifts = 1 + Math.floor(r() * 3);
    out.push(
      wk(
        `r${i}`,
        Math.round(NOW - ago * DAY),
        Array.from({ length: lifts }, (_, k) => {
          const name = LIFTS[Math.floor(r() * LIFTS.length)];
          return {
            ...ex(name, 1 + Math.floor(r() * 8), 40 + Math.floor(r() * 3) * 10),
            id: `x${i}${k}`,
          };
        }),
      ),
    );
  }
  return out;
}

describe('SPO-353: properties of the fatigue read (seeded, 300 cases)', () => {
  it('no sets in the window => score 0 and never high/fried', () => {
    const r = rng(352);
    for (let c = 0; c < 300; c++) {
      const h = randomHistory(r);
      for (const f of muscleFatigue(h, NOW).values()) {
        if (f.sets <= 0) {
          expect(f.score).toBe(0);
          expect(f.level).toBe('fresh');
        }
      }
    }
  });

  it('time only helps: moving "now" later never raises any muscle\'s fatigue', () => {
    const r = rng(7);
    for (let c = 0; c < 200; c++) {
      const h = randomHistory(r);
      const m0 = muscleFatigue(h, NOW);
      const later = NOW + (0.1 + r() * 20) * DAY;
      const m1 = muscleFatigue(h, later);
      // `stalled` looks back 35 days, so only compare the load-driven part (sets), then the score.
      for (const m of VOLUME_MUSCLES) {
        const a = m0.get(m)!;
        const b = m1.get(m)!;
        expect(b.sets).toBeLessThanOrEqual(a.sets + 1e-9);
        expect(b.score).toBeLessThanOrEqual(a.score + 1e-9);
        expect(lvlRank[b.level]).toBeLessThanOrEqual(lvlRank[a.level]);
      }
    }
  });

  it('is deterministic and does not depend on input order or the week-start setting', () => {
    const r = rng(99);
    for (let c = 0; c < 100; c++) {
      const h = randomHistory(r);
      const a = muscleFatigue(h, NOW);
      const b = muscleFatigue([...h].reverse(), NOW);
      expect([...b.entries()]).toEqual([...a.entries()].map(([k]) => [k, b.get(k)]));
      for (const [k, v] of a) expect(b.get(k)).toEqual(v);
      setWeekStartDay(7);
      const d = muscleFatigue(h, NOW);
      setWeekStartDay(1);
      for (const [k, v] of a) expect(d.get(k)).toEqual(v);
    }
  });

  it('after 8+ idle days every muscle is fresh, whatever the history looked like', () => {
    const r = rng(2026);
    for (let c = 0; c < 200; c++) {
      const h = randomHistory(r);
      const idle = Math.max(...h.map((w) => w.startedAt)) + 8 * DAY;
      for (const f of muscleFatigue(h, idle).values()) expect(f.level).toBe('fresh');
    }
  });
});

describe('fatigue levels and sources of fatigue', () => {
  it('a heavy week on chest reads high or fried, a light one does not', () => {
    const heavy = [wk('h', NOW - 1 * DAY, [ex(PRESS, 24)])];
    const light = [wk('l', NOW - 1 * DAY, [ex(PRESS, 3)])];
    const h = muscleFatigue(heavy, NOW).get('chest')!;
    expect(['high', 'fried']).toContain(h.level);
    expect(h.sets).toBe(24);
    expect(h.mrv).toBe(LANDMARKS.chest!.mrv);
    expect(muscleFatigue(light, NOW).get('chest')!.level).toBe('fresh');
  });

  it('the same heavy week fades to fresh once it is older than the window', () => {
    const heavy = [wk('h', NOW - 1 * DAY, [ex(PRESS, 24)])];
    const lv = (d: number) => muscleFatigue(heavy, NOW + d * DAY).get('chest')!.level;
    expect(lvlRank[lv(5)]).toBeLessThanOrEqual(lvlRank[lv(0)]);
    expect(lv(7)).toBe('fresh');
  });

  it('a stalled lift WITH direct sets still adds its bump (stall stays a real signal)', () => {
    const base = [wk('b0', NOW - 1 * DAY, [ex(PRESS, 3, 60)])];
    const withStall = [...flatLift(1, 4, 3)];
    const a = muscleFatigue(base, NOW).get('chest')!;
    const b = muscleFatigue(withStall, NOW).get('chest')!;
    expect(b.stalled).toBe(true);
    expect(b.score).toBeGreaterThan(a.score);
  });

  it('stabilizer-only work with a stalled lift stays below fried and shows no stall bump', () => {
    // Deadlift loads lower back as a primary; pressing loads front delts/triceps as secondary.
    const h = flatLift(2, 4, 8);
    const sh = muscleFatigue(h, NOW).get('shoulders')!;
    expect(sh.level).not.toBe('fried');
  });

  it('muscles are independent: chest load does not tire quads', () => {
    const m = muscleFatigue([wk('c', NOW - DAY, [ex(PRESS, 24)])], NOW);
    expect(m.get('quads')!.level).toBe('fresh');
  });

  it('a personalised (higher) ceiling lowers the read at equal volume', () => {
    const h = [wk('h', NOW - DAY, [ex(PRESS, 18)])];
    const lm = new Map([['chest' as const, { mev: 10, mav: 20, mrv: 40 }]]);
    const dflt = muscleFatigue(h, NOW).get('chest')!;
    const tol = muscleFatigue(h, NOW, lm).get('chest')!;
    expect(tol.score).toBeLessThanOrEqual(dflt.score);
    expect(tol.mrv).toBe(40);
  });

  it('deload suggestion: nothing for a rested athlete (even with stalled lifts)', () => {
    const rested = muscleFatigue(flatLift(10), NOW);
    expect(deloadSuggestion(rested)).toMatchObject({ kind: 'none', friedCount: 0, highCount: 0 });
  });

  it('deload suggestion: one fried muscle -> local, many hot -> systemic, bias shifts the trigger', () => {
    const fat = (levels: Array<[string, 'fresh' | 'moderate' | 'high' | 'fried', number]>) =>
      new Map(
        levels.map(([m, level, score]) => [
          m as 'chest',
          { muscle: m as 'chest', score, level, sets: 10, mrv: 20, stalled: false },
        ]),
      );
    const one = fat([
      ['chest', 'fried', 0.9],
      ['lats', 'fresh', 0],
    ]);
    expect(deloadSuggestion(one)).toMatchObject({ kind: 'local', muscle: 'chest' });
    const three = fat([
      ['chest', 'fried', 0.9],
      ['lats', 'fried', 0.8],
      ['quads', 'fried', 0.7],
    ]);
    expect(deloadSuggestion(three).kind).toBe('systemic');
    expect(deloadSuggestion(three, 1).kind).toBe('local'); // recovery-dominant week holds it off
    const five = fat(
      ['chest', 'lats', 'quads', 'biceps', 'triceps'].map(
        (m) => [m, 'high', 0.5] as [string, 'high', number],
      ),
    );
    expect(deloadSuggestion(five).kind).toBe('systemic');
    expect(deloadSuggestion(five, 1).kind).toBe('none');
  });
});

describe('time boundaries (SPO-353)', () => {
  const withTZ = (tz: string, fn: () => void) => {
    const prev = process.env.TZ;
    process.env.TZ = tz;
    try {
      fn();
    } finally {
      if (prev === undefined) delete process.env.TZ;
      else process.env.TZ = prev;
    }
  };

  it('the 7-day window is exact: 6d23h ago counts, 7d0h01m ago does not', () => {
    const at = (ms: number) => [wk('e', NOW - ms, [ex(PRESS, 6)])];
    expect(muscleFatigue(at(7 * DAY - 60000), NOW).get('chest')!.sets).toBe(6);
    expect(muscleFatigue(at(7 * DAY + 60000), NOW).get('chest')!.sets).toBe(0);
  });

  it('is identical in UTC and Europe/Warsaw (instants, not wall-clock)', () => {
    const h = [wk('a', NOW - 2 * DAY, [ex(PRESS, 20)]), ...flatLift(3)];
    let utc!: unknown;
    let waw!: unknown;
    withTZ('UTC', () => (utc = [...muscleFatigue(h, NOW).values()]));
    withTZ('Europe/Warsaw', () => (waw = [...muscleFatigue(h, NOW).values()]));
    expect(waw).toEqual(utc);
  });

  it('across the autumn DST change (25 Oct 2026, Warsaw) the window still follows elapsed time', () => {
    withTZ('Europe/Warsaw', () => {
      // Mon 19 Oct 18:00 CEST (UTC+2) -> Mon 26 Oct 18:00 CET (UTC+1): 7 calendar days, 169 h.
      const session = Date.UTC(2026, 9, 19, 16, 0);
      const now = Date.UTC(2026, 9, 26, 17, 0);
      const h = [wk('d', session, [ex(PRESS, 6)])];
      expect(muscleFatigue(h, now).get('chest')!.sets).toBe(0);
      // Tue 20 Oct 18:00 CEST is 6 d 23 h before: still inside.
      const h2 = [wk('d2', Date.UTC(2026, 9, 20, 16, 0), [ex(PRESS, 6)])];
      expect(muscleFatigue(h2, now).get('chest')!.sets).toBe(6);
    });
  });

  it('across the spring DST change (29 Mar 2026, Warsaw) likewise', () => {
    withTZ('Europe/Warsaw', () => {
      const now = Date.UTC(2026, 2, 30, 16, 0); // Mon 30 Mar 18:00 CEST
      const inside = Date.UTC(2026, 2, 23, 18, 0); // Mon 23 Mar 19:00 CET = 6 d 22 h earlier
      const h = [wk('s', inside, [ex(PRESS, 6)])];
      expect(muscleFatigue(h, now).get('chest')!.sets).toBe(6);
      expect(muscleFatigue(h, now + 3 * 3600000).get('chest')!.sets).toBe(0);
    });
  });

  it('"days since" in the hint is calendar days in the local zone', () => {
    withTZ('Europe/Warsaw', () => {
      // Sat 24 Oct 23:30 CEST -> Mon 26 Oct 00:30 CET: 25 h apart, 2 calendar days.
      const last = Date.UTC(2026, 9, 24, 21, 30);
      const now = Date.UTC(2026, 9, 25, 23, 30);
      const h = [wk('z', last, [ex(PRESS, 6)])];
      const map = muscleFatigue(h, now);
      const why = fatigueWhy(['chest'], h, now, map);
      expect(why).toEqual({ kind: 'load', sets: 6, mrv: LANDMARKS.chest!.mrv });
      const later = now + 8 * DAY;
      const w2 = fatigueWhy(['chest'], h, later, muscleFatigue(h, later));
      expect(w2).toEqual({ kind: 'idle', days: 10 });
    });
  });
});

describe('one module for every screen (SPO-304 / SPO-352)', () => {
  const ownerCase = flatLift(9); // last session 9 days ago, lift flat, 0 sets in the last 7 days

  it('card, detail, sub chips, family header and the Progress map agree and read fresh', () => {
    const map = fatigueByGroup(ownerCase, NOW);
    const direct = muscleFatigue(ownerCase, NOW); // what Progress / Today / MuscleStatePanel call
    for (const f of FAMILIES) {
      expect(familyFatigueLevel(f.groups, map)).toBe('fresh');
      for (const g of f.groups) {
        expect(groupFatigueLevel(g, map)).toBe('fresh');
        if (direct.get(g)) expect(direct.get(g)!.level).toBe(map.get(g)!.level);
      }
    }
    expect(fatigueWhy(['chest'], ownerCase, NOW, map)).toEqual({ kind: 'idle', days: 9 });
  });

  it('the readiness (time) axis agrees: nothing is recovering 9 days after the last session', () => {
    expect(readinessMood(muscleReadinessOf(ownerCase, NOW))).toBe('fresh');
  });

  it('a family header shows its worst muscle and the hint explains that very muscle', () => {
    const h = [wk('c', NOW - DAY, [ex(PRESS, 24)])];
    const map = fatigueByGroup(h, NOW);
    const fam = FAMILIES.find((f) => f.groups.includes('chest'))!;
    const lvl = familyFatigueLevel(fam.groups, map);
    expect(lvl).not.toBe('fresh');
    expect(fatigueWhy(fam.groups, h, NOW, map)).toMatchObject({ kind: 'load', sets: 24 });
  });
});
