import { describe, expect, it } from 'vitest';
import {
  dayLoad,
  followerOf,
  lastLoggedByType,
  median,
  paceStr,
  roundDuration,
  suggestActivities,
  timeBand,
} from './activitySuggest';
import type { Activity, Workout } from './types';

const MIN = 60_000;
let seq = 0;

/** Local time on a given calendar day. */
function at(y: number, m: number, d: number, hh: number, mm = 0): number {
  return new Date(y, m - 1, d, hh, mm).getTime();
}

function act(type: string, start: number, minutes: number, over: Partial<Activity> = {}): Activity {
  seq += 1;
  return {
    id: `a${seq}`,
    type,
    category: type === 'sauna' || type === 'yoga' ? 'recovery' : 'conditioning',
    startedAt: start,
    finishedAt: start + minutes * MIN,
    durationMin: minutes,
    ...over,
  };
}

// Saturday 27 Sep 2025, 18:40 — the design's "now".
const NOW = at(2025, 9, 27, 18, 40);
// The four Saturdays before it.
const SATS: Array<[number, number]> = [
  [8, 30],
  [9, 6],
  [9, 13],
  [9, 20],
];

function saturdayHistory(): Activity[] {
  const out: Activity[] = [];
  const mins = [110, 130, 115, 125];
  SATS.forEach(([m, d], i) => {
    out.push(act('dance', at(2025, m, d, 18, 30), mins[i]));
    // Sauna after Dance on 3 of the 4.
    if (i !== 1) out.push(act('sauna', at(2025, m, d, 20, 50), 20));
  });
  // Morning walks on two Saturdays.
  out.push(act('walk', at(2025, 9, 13, 8, 0), 30));
  out.push(act('walk', at(2025, 9, 20, 8, 10), 30));
  // Some weekday noise.
  out.push(act('run', at(2025, 9, 25, 7, 30), 30, { distanceKm: 5 }));
  out.push(act('run', at(2025, 9, 18, 7, 30), 32));
  return out;
}

describe('helpers', () => {
  it('time bands', () => {
    expect(timeBand(at(2025, 9, 27, 7))).toBe('morning');
    expect(timeBand(at(2025, 9, 27, 13))).toBe('afternoon');
    expect(timeBand(at(2025, 9, 27, 18, 40))).toBe('evening');
    expect(timeBand(at(2025, 9, 27, 23))).toBe('night');
    expect(timeBand(at(2025, 9, 27, 3))).toBe('night');
  });
  it('median and duration rounding', () => {
    expect(median([110, 130, 115, 125])).toBe(120);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBe(0);
    expect(roundDuration(118)).toBe(120);
    expect(roundDuration(22)).toBe(20);
    expect(roundDuration(2)).toBe(5);
    expect(roundDuration(0)).toBe(0);
  });
  it('pace', () => {
    expect(paceStr(30, 5)).toBe('6:00');
    expect(paceStr(25, 4.2)).toBe('5:57');
    expect(paceStr(30, 0)).toBeNull();
    expect(paceStr(0, 5)).toBeNull();
  });
});

describe('suggestActivities', () => {
  it('no history → no hero, first-time flag off', () => {
    const r = suggestActivities([], NOW);
    expect(r.hasHistory).toBe(false);
    expect(r.hero).toBeNull();
    expect(r.also).toEqual([]);
  });

  it('predicts the weekday + time-of-day habit with median duration', () => {
    const r = suggestActivities(saturdayHistory(), NOW);
    expect(r.hasHistory).toBe(true);
    expect(r.weekday).toBe(6);
    const hero = r.hero;
    expect(hero?.kind).toBe('likely');
    if (hero?.kind !== 'likely') return;
    expect(hero.type).toBe('dance');
    expect(hero.count).toBe(4);
    expect(hero.weeks).toBe(4);
    expect(hero.medianMin).toBe(120);
    expect(hero.usualStartMin).toBe(18 * 60 + 30);
    expect(hero.band).toBe('evening');
    expect(hero.recent.map((o) => o.minutes)).toEqual([110, 130, 115, 125]);
  });

  it('secondary cards: what follows the hero, then other frequent types this weekday', () => {
    const r = suggestActivities(saturdayHistory(), NOW);
    expect(r.also.map((s) => [s.type, s.reason])).toEqual([
      ['sauna', 'after'],
      ['walk', 'band'],
    ]);
    expect(r.also[0]).toMatchObject({ after: 'dance', count: 3, medianMin: 20, doneAt: null });
    expect(r.also[1]).toMatchObject({ band: 'morning', count: 2, medianMin: 30 });
  });

  it('hides the hero when there is no real pattern', () => {
    const r = suggestActivities([act('dance', at(2025, 9, 20, 18), 60)], NOW);
    expect(r.hero).toBeNull();
    // A different time of day doesn't count as "now".
    const morning = suggestActivities(
      [act('walk', at(2025, 9, 13, 8), 30), act('walk', at(2025, 9, 20, 8), 30)],
      NOW,
    );
    expect(morning.hero).toBeNull();
  });

  it('respects the look-back window', () => {
    const old = [act('golf', at(2025, 6, 7, 18), 90), act('golf', at(2025, 6, 14, 18), 90)];
    expect(suggestActivities(old, NOW).hero).toBeNull();
  });

  it('skips a dismissed type', () => {
    const r = suggestActivities(saturdayHistory(), NOW, { exclude: ['dance'] });
    expect(r.hero?.type).not.toBe('dance');
  });

  it('after logging today → "up next" is what usually follows it', () => {
    const list = [...saturdayHistory(), act('dance', at(2025, 9, 27, 16, 30), 120)];
    const r = suggestActivities(list, NOW);
    expect(r.hero).toMatchObject({
      kind: 'upnext',
      type: 'sauna',
      after: 'dance',
      count: 3,
      of: 4,
    });
    expect(r.hero?.medianMin).toBe(20);
    // Dance done today is still listed, marked done.
    const dance = r.also.find((s) => s.type === 'dance');
    expect(dance?.doneAt).toBe(at(2025, 9, 27, 16, 30));
  });

  it('does not re-suggest a type already logged today as the hero', () => {
    // Logged in the morning (so no "up next" window), Dance still today.
    const list = [...saturdayHistory(), act('dance', at(2025, 9, 27, 9), 60)];
    const r = suggestActivities(list, NOW);
    expect(r.hero?.type).not.toBe('dance');
  });

  it('ignores live activities', () => {
    const live = { ...act('dance', at(2025, 9, 20, 18, 30), 0), finishedAt: null, durationMin: 0 };
    const r = suggestActivities([live], NOW);
    expect(r.hasHistory).toBe(false);
  });
});

describe('followerOf', () => {
  it('what usually follows a type (live "After Dance, usually")', () => {
    expect(followerOf(saturdayHistory(), 'dance', NOW)).toEqual({
      type: 'sauna',
      medianMin: 20,
      count: 3,
      of: 4,
    });
    expect(followerOf(saturdayHistory(), 'run', NOW)).toBeNull();
  });
});

describe('lastLoggedByType', () => {
  it('keeps the newest per type', () => {
    const m = lastLoggedByType(saturdayHistory());
    expect(m.get('run')?.startedAt).toBe(at(2025, 9, 25, 7, 30));
    expect(m.get('dance')?.durationMin).toBe(125);
    expect(m.has('golf')).toBe(false);
  });
});

describe('dayLoad', () => {
  it('lifting + weighted conditioning, recovery eases it', () => {
    const w: Workout = {
      id: 'w',
      startedAt: at(2025, 9, 27, 11),
      finishedAt: at(2025, 9, 27, 11, 58),
      autoFinished: false,
      exercises: [],
    };
    const acts = [
      act('walk', at(2025, 9, 27, 8, 40), 20),
      act('sauna', at(2025, 9, 26, 20), 20), // yesterday — ignored
    ];
    const l = dayLoad([w], acts, NOW);
    expect(l.liftMin).toBe(58);
    expect(l.conditioningMin).toBe(20);
    expect(l.recoveryMin).toBe(0);
    expect(l.level).toBe('moderate');
    expect(l.frac).toBeCloseTo(78 / 240, 5);
    const eased = dayLoad([w], [...acts, act('sauna', at(2025, 9, 27, 17), 40)], NOW);
    expect(eased.recoveryMin).toBe(40);
    expect(eased.frac).toBeLessThan(l.frac);
  });
  it('empty day is light', () => {
    expect(dayLoad([], [], NOW)).toMatchObject({ level: 'light', frac: 0 });
  });
});
