import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CHALLENGE_CATEGORIES,
  activeTemplateIds,
  challengeCatalog,
  challengeCtx,
  challengeProgress,
  fmtChallengeDuration,
  fmtChallengeValue,
  isReach,
  templateById,
} from './challenges';
import type { ActiveChallenge, ChallengeTemplate, Metric } from './challenges';
import { LOCALES } from './i18n';
import type { Activity, Exercise, SetEntry, Workout } from './types';

const DAY = 24 * 3600 * 1000;
/** Local-time stamp (dayKey is local-calendar based, so tests are timezone independent). */
const at = (day: number, hour = 12): number => new Date(2026, 9, day, hour).getTime();
const en = LOCALES.en;

let seq = 0;
function set(reps: number, weight: number | null, o: Partial<SetEntry> = {}): SetEntry {
  return {
    id: `s${seq++}`,
    position: 0,
    reps,
    weight,
    isWarmup: false,
    type: 'working',
    ...o,
  } as SetEntry;
}
function ex(name: string, sets: SetEntry[], o: Partial<Exercise> = {}): Exercise {
  return {
    id: `e${seq++}`,
    name,
    kind: 'strength',
    position: 0,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    sets,
    ...o,
  } as Exercise;
}
function wk(
  startedAt: number,
  exercises: Exercise[],
  finishedAt: number | null = startedAt + 3600_000,
) {
  return { id: `w${seq++}`, startedAt, finishedAt, autoFinished: false, exercises } as Workout;
}
function act_(type: string, startedAt: number, o: Partial<Activity> = {}): Activity {
  return {
    id: `a${seq++}`,
    type,
    category: 'conditioning',
    startedAt,
    finishedAt: startedAt + 1800_000,
    durationMin: 30,
    ...o,
  } as Activity;
}

type Ctx = Parameters<typeof challengeProgress>[2];
function ctx(o: Partial<Ctx> & { now: number }): Ctx {
  return {
    finished: [],
    activities: [],
    bodyKg: 80,
    sex: 'M',
    restDays: new Set<number>(),
    protectedDay: () => false,
    ...o,
  };
}
const custom = (metric: Metric, unit: ChallengeTemplate['unit'] = 'sets'): ChallengeTemplate => ({
  id: 'x',
  category: 'volume',
  icon: 'x',
  accent: 'brass',
  metric,
  unit,
  target: 1,
  min: 1,
  max: 1,
  step: 1,
  durations: [1],
  title: () => '',
  blurb: () => '',
  keywords: '',
});
const ch = (startedAt: number, days: number, target: number): ActiveChallenge => ({
  id: 'c',
  templateId: 't',
  startedAt,
  endsAt: startedAt + days * DAY,
  target,
  status: 'active',
});
const value = (m: Metric, c: Ctx, start = at(1), days = 30, target = 1000): number =>
  challengeProgress(ch(start, days, target), custom(m), c).value;

describe('catalog', () => {
  const cat = challengeCatalog();

  it('is built once and cached', () => {
    expect(challengeCatalog()).toBe(cat);
  });

  it('has unique ids and covers every category', () => {
    const ids = cat.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const category of CHALLENGE_CATEGORIES) {
      expect(cat.some((c) => c.category === category)).toBe(true);
    }
  });

  it('every template has a sane stepper range and at least one duration', () => {
    for (const c of cat) {
      expect(c.min).toBeLessThanOrEqual(c.target);
      expect(c.target).toBeLessThanOrEqual(c.max);
      expect(c.step).toBeGreaterThan(0);
      expect(c.durations.length).toBeGreaterThan(0);
      expect(c.durations.every((d) => d > 0)).toBe(true);
    }
  });

  it('every title and blurb renders non-empty text in all five locales', () => {
    for (const locale of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
      for (const c of cat) {
        expect(c.title(LOCALES[locale], c.target).length).toBeGreaterThan(0);
        expect(c.blurb(LOCALES[locale]).length).toBeGreaterThan(0);
      }
    }
  });

  it('builds localized titles with the target filled in', () => {
    expect(templateById('vol:chest')!.title(en, 120)).toBe('120 chest sets');
    expect(templateById('strength:bench')!.title(en, 100)).toBe('Reach 100 kg bench');
    expect(templateById('streak:30')!.title(en, 30)).toBe('30-day streak');
    expect(templateById('cons:4:8')!.title(en, 32)).toBe('Train 4×/week for 8 weeks');
    expect(templateById('tonnage')!.title(en, 100000)).toBe('Lift 100 t');
  });

  it('falls back to the raw key when a locale lacks a zone / lift / activity name', () => {
    const bare = {
      ...en,
      volZoneNames: {},
      chLift: {},
      chBw: {},
      actType: {},
    } as unknown as typeof en;
    expect(templateById('vol:chest')!.title(bare, 120)).toBe('120 chest sets');
    expect(templateById('strength:ohp')!.title(bare, 60)).toContain('ohp');
    expect(templateById('bw:pullup')!.title(bare, 500)).toContain('pullup');
    expect(templateById('dist:run')!.title(bare, 50)).toContain('run');
  });

  it('streak challenges have exactly one duration: the streak length plus a grace margin', () => {
    const dur = (n: number) => templateById(`streak:${n}`)!.durations;
    expect([7, 14, 30, 50, 100, 365].map(dur)).toEqual([[10], [18], [38], [63], [125], [456]]);
    for (const n of [7, 14, 30, 50, 100, 365]) {
      const t = templateById(`streak:${n}`)!;
      expect([t.min, t.target, t.max]).toEqual([n, n, n]);
    }
  });

  it('consistency challenges target N x weeks sessions over exactly those weeks', () => {
    for (const per of [3, 4, 5]) {
      for (const weeks of [4, 8, 12]) {
        const t = templateById(`cons:${per}:${weeks}`)!;
        expect(t.target).toBe(per * weeks);
        expect(t.durations).toEqual([weeks * 7]);
        expect(t.metric).toEqual({ kind: 'trainingDays' });
      }
    }
  });

  it('templateById returns undefined for unknown ids', () => {
    expect(templateById('nope')).toBeUndefined();
  });

  it('isReach is true only for strength, streak and balance', () => {
    const kinds = new Map(cat.map((c) => [c.metric.kind, isReach(c.metric)]));
    for (const [kind, reach] of kinds) {
      expect(reach).toBe(['strength', 'streak', 'balance'].includes(kind));
    }
  });
});

describe('formatting', () => {
  it('fmtChallengeValue by unit', () => {
    expect(fmtChallengeValue('kg', 500, en)).toBe('500 kg');
    expect(fmtChallengeValue('kg', 9999.4, en)).toBe('9999 kg');
    expect(fmtChallengeValue('kg', 10000, en)).toBe('10 t');
    expect(fmtChallengeValue('kg', 12345, en)).toBe('12.3 t');
    expect(fmtChallengeValue('km', 12.6, en)).toBe('13 km');
    expect(fmtChallengeValue('min', 59.5, en)).toBe('60 min');
    expect(fmtChallengeValue('kcal', 12345.4, en)).toMatch(/^12\D?345 kcal$/);
    expect(fmtChallengeValue('sets', 7.5, en)).toBe('8');
    expect(fmtChallengeValue('reps', 100, en)).toBe('100');
  });

  it.each([
    [365, '1 year'],
    [730, '2 years'],
    [90, '3 months'],
    [30, '1 month'],
    [360, '12 months'],
    [28, '4 weeks'],
    [7, '1 week'],
    [364, '52 weeks'],
    [10, '10 days'],
    [29, '29 days'],
    [1, '1 day'],
  ])('fmtChallengeDuration(%i) = %s', (days, label) => {
    expect(fmtChallengeDuration(days, en)).toBe(label);
  });
});

describe('active-challenge store', () => {
  afterEach(() => {
    localStorage.clear();
    vi.doUnmock('./firebase');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  async function fresh(preset?: string) {
    vi.resetModules();
    // The Firebase SDK refuses a second initialisation; the challenge store never touches it.
    vi.doMock('./firebase', () => ({ db: {} }));
    localStorage.clear();
    if (preset !== undefined) localStorage.setItem('spotter.challenges', preset);
    return import('./challenges');
  }

  it('startChallenge prepends an active challenge ending after the duration and persists it', async () => {
    const m = await fresh();
    const a = m.startChallenge('sessions', 50, 90, at(1));
    const b = m.startChallenge('prs', 10, 30, at(2));
    expect(a).toMatchObject({
      templateId: 'sessions',
      target: 50,
      startedAt: at(1),
      endsAt: at(1) + 90 * DAY,
      status: 'active',
      completedAt: null,
    });
    expect(a.id).not.toBe(b.id);
    const saved = JSON.parse(localStorage.getItem('spotter.challenges')!);
    expect(saved.map((c: ActiveChallenge) => c.id)).toEqual([b.id, a.id]);
  });

  it('loads a saved list on startup and survives corrupt storage', async () => {
    const saved: ActiveChallenge[] = [
      { id: 'k', templateId: 'prs', startedAt: 1, endsAt: 2, target: 3, status: 'active' },
    ];
    const ok = await fresh(JSON.stringify(saved));
    ok.giveUpChallenge('nope'); // no-op commit just to read the list back
    expect(JSON.parse(localStorage.getItem('spotter.challenges')!)).toEqual(saved);

    const bad = await fresh('{not json');
    const c = bad.startChallenge('prs', 3, 90, at(1));
    expect(JSON.parse(localStorage.getItem('spotter.challenges')!)).toEqual([c]);
  });

  it('giveUpChallenge removes only that challenge', async () => {
    const m = await fresh();
    const a = m.startChallenge('sessions', 50, 90, at(1));
    const b = m.startChallenge('prs', 10, 30, at(1));
    m.giveUpChallenge(a.id);
    expect(
      JSON.parse(localStorage.getItem('spotter.challenges')!).map((c: { id: string }) => c.id),
    ).toEqual([b.id]);
  });

  it('markChallengeDone completes an active challenge once and is idempotent', async () => {
    const m = await fresh();
    const a = m.startChallenge('sessions', 50, 90, at(1));
    m.markChallengeDone(a.id, at(5));
    const first = JSON.parse(localStorage.getItem('spotter.challenges')!)[0];
    expect(first).toMatchObject({ status: 'done', completedAt: at(5) });
    m.markChallengeDone(a.id, at(9)); // already done: completion time must not move
    expect(JSON.parse(localStorage.getItem('spotter.challenges')!)[0].completedAt).toBe(at(5));
    m.markChallengeDone('unknown', at(9));
    expect(JSON.parse(localStorage.getItem('spotter.challenges')!)).toHaveLength(1);
  });

  it('markCelebrated flags once and ignores unknown ids', async () => {
    const m = await fresh();
    const a = m.startChallenge('sessions', 50, 90, at(1));
    m.markCelebrated(a.id);
    expect(JSON.parse(localStorage.getItem('spotter.challenges')!)[0].celebrated).toBe(true);
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    m.markCelebrated(a.id); // already celebrated: nothing to write
    m.markCelebrated('unknown');
    expect(spy).not.toHaveBeenCalled();
  });

  it('keeps working when storage rejects writes (private mode / quota)', async () => {
    const m = await fresh();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => m.startChallenge('prs', 3, 30, at(1))).not.toThrow();
  });

  it('useChallenges re-renders subscribers when the list changes', async () => {
    const m = await fresh();
    const seen: number[] = [];
    function Probe() {
      seen.push(m.useChallenges().length);
      return null;
    }
    const host = document.createElement('div');
    const root = createRoot(host);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => root.render(createElement(Probe)));
    await act(async () => {
      m.startChallenge('prs', 3, 30, at(1));
    });
    await act(async () => {
      m.startChallenge('sessions', 3, 30, at(1));
    });
    await act(async () => root.unmount());
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(2);
    // after unmount the listener is gone: another change must not throw
    expect(() => m.startChallenge('prs', 3, 30, at(1))).not.toThrow();
  });

  it('activeTemplateIds lists only challenges still in progress', () => {
    const mk = (templateId: string, status: ActiveChallenge['status']): ActiveChallenge => ({
      id: templateId + status,
      templateId,
      startedAt: 0,
      endsAt: 1,
      target: 1,
      status,
    });
    expect([
      ...activeTemplateIds([
        mk('a', 'active'),
        mk('b', 'done'),
        mk('c', 'given-up'),
        mk('a', 'active'),
      ]),
    ]).toEqual(['a']);
    expect(activeTemplateIds([]).size).toBe(0);
  });
});

describe('challengeCtx', () => {
  const store = (o: Record<string, unknown> = {}) =>
    ({
      workouts: [wk(at(1), []), wk(at(2), [], null)],
      activities: [act_('run', at(3))],
      bodyMetrics: {
        sex: 'female',
        weights: [
          { id: 'a', at: at(1), weight: 70 },
          { id: 'b', at: at(2), weight: 65 },
        ],
      },
      restPeriods: [{ id: 'r', startDay: 20000, endDay: 20002, open: false }],
      ...o,
    }) as unknown as Parameters<typeof challengeCtx>[0];

  it('keeps finished workouts only, the latest bodyweight and the sex letter', () => {
    const c = challengeCtx(store(), at(10));
    expect(c.finished).toHaveLength(1);
    expect(c.activities).toHaveLength(1);
    expect(c.bodyKg).toBe(65);
    expect(c.sex).toBe('F');
    expect(c.now).toBe(at(10));
    expect([...c.restDays]).toEqual([20000, 20001, 20002]);
    expect(c.protectedDay(1)).toBe(false);
  });

  it('defaults: male, no weight, no activities', () => {
    const c = challengeCtx(
      store({ activities: undefined, bodyMetrics: { weights: [] }, restPeriods: [] }),
      at(10),
    );
    expect(c.sex).toBe('M');
    expect(c.bodyKg).toBe(0);
    expect(c.activities).toEqual([]);
    expect(c.restDays.size).toBe(0);
  });
});

describe('cumulative metrics', () => {
  const start = at(1);
  const now = at(10);

  it('zoneSets: fractional sets of the zone members (secondary = half), inside the window only', () => {
    const press = ex('Zed Press', [set(8, 50), set(8, 50), set(8, 50), set(8, 50)], {
      primaryMuscle: 'chest',
      secondaryMuscles: ['triceps'],
    });
    const c = ctx({
      now,
      finished: [wk(at(2), [press]), wk(at(3), [press]), wk(at(0), [press]) /* before start */],
    });
    expect(value({ kind: 'zoneSets', zone: 'chest' }, c, start)).toBe(8);
    expect(value({ kind: 'zoneSets', zone: 'arms' }, c, start)).toBe(4);
    expect(value({ kind: 'zoneSets', zone: 'legs' }, c, start)).toBe(0);
    expect(value({ kind: 'zoneSets', zone: 'nonsense' }, c, start)).toBe(0);
  });

  it('window edges: a session exactly at the start counts; one after "now" or after the end does not', () => {
    const one = (t: number) => wk(t, [ex('Zed', [set(5, 50)])]);
    const c = ctx({ now, finished: [one(start), one(now), one(now + 1), one(start - 1)] });
    expect(value({ kind: 'sessions' }, c, start)).toBe(2);
    // challenge ended before "now": capped at endsAt
    expect(value({ kind: 'sessions' }, c, start, 5)).toBe(1);
  });

  it('totalSets counts working sets of strength exercises only (no warm-ups, no cardio)', () => {
    const lift = ex('Zed', [
      set(5, 50),
      set(5, 50, { type: 'warmup', isWarmup: true }),
      set(3, 60, { type: 'drop' }),
    ]);
    const run = ex('Treadmill', [set(1, null)], { kind: 'cardio' });
    const c = ctx({ now, finished: [wk(at(2), [lift, run])] });
    expect(value({ kind: 'totalSets' }, c, start)).toBe(2);
  });

  it('tonnage sums external load x reps (warm-ups included, bodyweight adds nothing)', () => {
    const a = ex('Zed Press', [set(5, 100), set(5, 100, { type: 'warmup', isWarmup: true })]);
    const b = ex('Zed Pull Up', [set(10, null)]);
    const c = ctx({ now, finished: [wk(at(2), [a, b])] });
    expect(value({ kind: 'tonnage' }, c, start)).toBe(1000);
  });

  it('reps: total working reps, drops included, optionally filtered by exercise name', () => {
    const pull = ex('Wide Pull-Up', [
      set(10, null),
      set(8, null),
      set(20, null, { type: 'warmup', isWarmup: true }),
    ]);
    const push = ex('Push Up', [set(30, null)]);
    const drop = ex('Zed Curl', [set(5, 20, { type: 'drop', drops: [{ weight: 15, reps: 5 }] })]);
    const c = ctx({ now, finished: [wk(at(2), [pull, push, drop])] });
    expect(value({ kind: 'reps' }, c, start)).toBe(10 + 8 + 30 + 10);
    expect(value({ kind: 'reps', match: 'pull up|pull-up' }, c, start)).toBe(18);
    expect(value({ kind: 'reps', match: 'PUSH' }, c, start)).toBe(30);
    expect(value({ kind: 'reps', match: 'dip' }, c, start)).toBe(0);
  });

  it('prs: counts sessions that beat an earlier top-set best, never the first ever lift', () => {
    const lift = (name: string, kg: number) => ex(name, [set(5, kg)]);
    const c = ctx({
      now,
      finished: [
        wk(at(2), [lift('Zed Squat', 100)]), // first ever: baseline, not a PR
        wk(at(3), [lift('Zed Squat', 100)]), // equal: no
        wk(at(4), [lift('zed squat', 105)]), // PR (case-insensitive name)
        wk(at(5), [lift('Zed Squat', 90)]), // lower: no
        wk(at(6), [lift('Zed Bench', 60), lift('Zed Squat', 110)]), // bench baseline; squat PR
        wk(at(7), [ex('Zed Pull Up', [set(10, null)])]), // no load: ignored
      ],
    });
    expect(value({ kind: 'prs' }, c, start)).toBe(2 + 0);
  });

  it('prs: only PRs set inside the window are counted, but earlier history is the baseline', () => {
    const lift = (kg: number) => ex('Zed Squat', [set(5, kg)]);
    const c = ctx({
      now,
      finished: [wk(at(1), [lift(100)]), wk(at(4), [lift(105)]), wk(at(8), [lift(110)])],
    });
    expect(value({ kind: 'prs' }, c, at(5))).toBe(1);
    expect(value({ kind: 'prs' }, c, at(1))).toBe(2);
  });

  it('prs: a drop-set weight counts as the top weight; the PR is stamped at its logged time', () => {
    const base = ex('Zed Curl', [set(8, 20)]);
    const dropped = ex('Zed Curl', [
      set(8, 18, { type: 'drop', drops: [{ weight: 25, reps: 4 }], loggedAt: at(6, 15) }),
    ]);
    const c = ctx({ now, finished: [wk(at(2), [base]), wk(at(6), [dropped])] });
    expect(value({ kind: 'prs' }, c, at(6, 14))).toBe(1);
    expect(value({ kind: 'prs' }, c, at(6, 16))).toBe(0); // stamp 15:00 is before this window
  });

  it('distance: km of the matching, finished activity type only', () => {
    const c = ctx({
      now,
      activities: [
        act_('run', at(2), { distanceKm: 5 }),
        act_('run', at(3), { distanceKm: 7.5 }),
        act_('run', at(4), { distanceKm: null }),
        act_('run', at(5), { distanceKm: 10, finishedAt: null }),
        act_('cycle', at(6), { distanceKm: 40 }),
        act_('run', at(0), { distanceKm: 99 }),
      ],
    });
    expect(value({ kind: 'distance', activity: 'run' }, c, start)).toBe(12.5);
    expect(value({ kind: 'distance', activity: 'cycle' }, c, start)).toBe(40);
    expect(value({ kind: 'distance', activity: 'swim' }, c, start)).toBe(0);
  });

  it('minutes: conditioning time only; stored duration wins, else start-to-finish', () => {
    const c = ctx({
      now,
      activities: [
        act_('run', at(2), { durationMin: 30 }),
        act_('hiit', at(3), { durationMin: 0, finishedAt: at(3) + 20 * 60000 }),
        act_('sauna', at(4), { category: 'recovery', durationMin: 60 }),
        act_('run', at(5), { durationMin: 0, finishedAt: at(5) }), // zero length
        act_('run', at(6), { durationMin: 45, finishedAt: null }), // still running
      ],
    });
    expect(value({ kind: 'minutes' }, c, start)).toBe(50);
  });

  it('activityCount: conditioning sessions (or one given type), finished only', () => {
    const c = ctx({
      now,
      activities: [
        act_('run', at(2)),
        act_('run', at(3)),
        act_('cycle', at(4)),
        act_('sauna', at(5), { category: 'recovery' }),
        act_('run', at(6), { finishedAt: null }),
      ],
    });
    expect(value({ kind: 'activityCount' }, c, start)).toBe(3);
    expect(value({ kind: 'activityCount', activity: 'run' }, c, start)).toBe(2);
    expect(value({ kind: 'activityCount', activity: 'sauna' }, c, start)).toBe(1);
  });

  it('calories: lifting sessions plus activities, needs a bodyweight', () => {
    const run = act_('run', at(3), { durationMin: 60 }); // 9.8 MET x 80 kg x 1 h = 784
    const c = ctx({
      now,
      activities: [run],
      finished: [wk(at(2), [ex('Zed', [set(5, 50)])])],
      bodyKg: 80,
    });
    const total = value({ kind: 'calories' }, c, start);
    expect(total).toBeGreaterThan(784);
    expect(value({ kind: 'calories' }, { ...c, finished: [] }, start)).toBe(784);
    expect(value({ kind: 'calories' }, { ...c, bodyKg: 0, finished: [] }, start)).toBe(0);
    const unknown = act_('mystery', at(4), { calories: 300 });
    expect(value({ kind: 'calories' }, ctx({ now, activities: [unknown], bodyKg: 0 }), start)).toBe(
      300,
    );
    const live = act_('run', at(5), { finishedAt: null });
    expect(value({ kind: 'calories' }, ctx({ now, activities: [live] }), start)).toBe(0);
  });

  it('an unrecognised metric kind reads as zero', () => {
    expect(value({ kind: 'bogus' } as unknown as Metric, ctx({ now }), start)).toBe(0);
  });
});

describe('reach and day-based metrics', () => {
  const start = at(1);

  it('trainingDays counts distinct days, mixing workouts and activities, inside the window', () => {
    const c = ctx({
      now: at(10),
      finished: [wk(at(2, 8), []), wk(at(2, 18), []), wk(at(3), []), wk(at(0), [])],
      activities: [
        act_('run', at(3, 9)),
        act_('run', at(4)),
        act_('run', at(5), { finishedAt: null }),
      ],
    });
    expect(value({ kind: 'trainingDays' }, c, start)).toBe(3);
  });

  it('streak counts consecutive covered days ending today, bridging up to two missed days', () => {
    const trained = [at(5), at(6), at(8), at(9)]; // gap on the 7th
    const c = ctx({ now: at(9), finished: trained.map((t) => wk(t, [])) });
    expect(value({ kind: 'streak' }, c, at(1))).toBe(4);
    // a third missed day in a row breaks the chain
    const c2 = ctx({ now: at(9), finished: [wk(at(5), []), wk(at(9), [])] });
    expect(value({ kind: 'streak' }, c2, at(1))).toBe(1);
  });

  it('streak: today still empty does not break it; rest days and protected days count as covered', () => {
    const c = ctx({
      now: at(9),
      finished: [wk(at(7), []), wk(at(8), [])],
    });
    expect(value({ kind: 'streak' }, c, at(1))).toBe(2);
    const dk = (d: number) => Math.floor(Date.UTC(2026, 9, d) / DAY);
    const rest = ctx({
      now: at(9),
      finished: [wk(at(7), []), wk(at(8), [])],
      restDays: new Set([dk(9)]),
    });
    expect(value({ kind: 'streak' }, rest, at(1))).toBe(3);
    const prot = ctx({
      now: at(9),
      finished: [wk(at(8), [])],
      protectedDay: (d) => d === dk(9) || d === dk(7),
    });
    expect(value({ kind: 'streak' }, prot, at(1))).toBe(3);
  });

  it('streak never reaches before the challenge start', () => {
    const c = ctx({ now: at(9), finished: [3, 4, 5, 6, 7, 8, 9].map((d) => wk(at(d), [])) });
    expect(value({ kind: 'streak' }, c, at(7))).toBe(3);
  });

  it('strength: the lifetime best e1RM on the discipline, 0 when untrained or unknown', () => {
    const bench = ex('Barbell Bench Press - Medium Grip', [set(3, 100)]);
    const c = ctx({ now: at(10), finished: [wk(at(2), [bench])] });
    expect(value({ kind: 'strength', discipline: 'bench' }, c, at(5))).toBe(110); // lifetime, not windowed
    expect(value({ kind: 'strength', discipline: 'squat' }, c, at(1))).toBe(0);
    expect(value({ kind: 'strength', discipline: 'no-such' }, c, at(1))).toBe(0);
  });

  it('balance: a 7-day block counts only when every landmarked muscle is productive or better', () => {
    const muscles = [
      'chest',
      'lats',
      'traps',
      'lower_back',
      'shoulders',
      'biceps',
      'triceps',
      'forearms',
      'quads',
      'hamstrings',
      'glutes',
      'calves',
      'core',
    ];
    const full = (t: number) =>
      wk(
        t,
        muscles.map((m) =>
          ex(
            `Zed ${m}`,
            Array.from({ length: 30 }, () => set(8, 50)),
            { primaryMuscle: m },
          ),
        ),
      );
    const missingCore = (t: number) =>
      wk(
        t,
        muscles
          .filter((m) => m !== 'core')
          .map((m) =>
            ex(
              `Zed ${m}`,
              Array.from({ length: 30 }, () => set(8, 50)),
              { primaryMuscle: m },
            ),
          ),
      );
    // started day 1 noon: block 1 closes at day 8 noon; now = day 8 noon -> exactly one block
    expect(
      value({ kind: 'balance' }, ctx({ now: at(1) + 7 * DAY, finished: [full(at(2))] }), at(1), 14),
    ).toBe(1);
    expect(
      value(
        { kind: 'balance' },
        ctx({ now: at(1) + 7 * DAY, finished: [missingCore(at(2))] }),
        at(1),
        14,
      ),
    ).toBe(0);
    // block not yet complete: nothing counted
    expect(
      value({ kind: 'balance' }, ctx({ now: at(1) + 6 * DAY, finished: [full(at(2))] }), at(1), 14),
    ).toBe(0);
    expect(value({ kind: 'balance' }, ctx({ now: at(1) + 7 * DAY, finished: [] }), at(1), 14)).toBe(
      0,
    );
  });

  it('balance stops counting at the challenge end', () => {
    const muscles = [
      'chest',
      'lats',
      'traps',
      'lower_back',
      'shoulders',
      'biceps',
      'triceps',
      'forearms',
      'quads',
      'hamstrings',
      'glutes',
      'calves',
      'core',
    ];
    const full = (t: number) =>
      wk(
        t,
        muscles.map((m) =>
          ex(
            `Zed ${m}`,
            Array.from({ length: 30 }, () => set(8, 50)),
            { primaryMuscle: m },
          ),
        ),
      );
    const c = ctx({ now: at(30), finished: [full(at(2)), full(at(9)), full(at(16))] });
    // 1-week challenge: only the first block can ever count
    expect(value({ kind: 'balance' }, c, at(1), 7)).toBe(1);
  });
});

describe('challengeProgress summary fields', () => {
  const tmpl = custom({ kind: 'sessions' });
  const sessions = (n: number, from = 2) =>
    Array.from({ length: n }, (_, i) => wk(at(from + i), []));

  it('computes percent, remaining pace, days left and done / ended flags', () => {
    const c = ctx({ now: at(1) + 10 * DAY, finished: sessions(4) });
    const p = challengeProgress(ch(at(1), 30, 10), tmpl, c);
    expect(p).toMatchObject({ value: 4, target: 10, pct: 0.4, done: false, ended: false });
    expect(p.daysLeft).toBe(20); // ends day 31 noon, now day 11 noon
    expect(p.perDayNeeded).toBe(6 / 20);
  });

  it('done once the target is met; percent is capped at 1 though the value keeps growing', () => {
    const c = ctx({ now: at(1) + 10 * DAY, finished: sessions(12) });
    const p = challengeProgress(ch(at(1), 30, 10), tmpl, c);
    expect(p).toMatchObject({ value: 10, pct: 1, done: true });
    // value counts every session up to "now" (days 2..11 = 10 sessions); add more days
    const c2 = ctx({ now: at(20), finished: sessions(15) });
    const p2 = challengeProgress(ch(at(1), 30, 10), tmpl, c2);
    expect(p2.value).toBe(15);
    expect(p2.pct).toBe(1);
    expect(p2.perDayNeeded).toBe(0);
  });

  it('ended exactly at the end instant; days left never negative and rounds up', () => {
    const END = at(1) + 30 * DAY;
    const c = ctx({ now: END, finished: [] });
    const atEnd = challengeProgress(ch(at(1), 30, 10), tmpl, c);
    expect(atEnd).toMatchObject({ ended: true, daysLeft: 0 });
    expect(atEnd.perDayNeeded).toBe(10); // nothing left to spread over: the remainder itself
    const before = challengeProgress(ch(at(1), 30, 10), tmpl, ctx({ now: END - 1 }));
    expect(before).toMatchObject({ ended: false, daysLeft: 1 });
    const after = challengeProgress(ch(at(1), 30, 10), tmpl, ctx({ now: END + 14 * DAY }));
    expect(after.daysLeft).toBe(0);
  });

  it('events after the end are not counted even though "now" is later', () => {
    const c = ctx({ now: at(1) + 35 * DAY, finished: [wk(at(20), []), wk(at(1) + 31 * DAY, [])] });
    expect(challengeProgress(ch(at(1), 30, 10), tmpl, c).value).toBe(1);
  });

  it('a zero target is never a percentage; it reads as already done', () => {
    const p = challengeProgress(ch(at(1), 30, 0), tmpl, ctx({ now: at(5) }));
    expect(p.pct).toBe(0);
    expect(p.done).toBe(true);
  });
});

describe('by-day strip', () => {
  const tmpl = custom({ kind: 'sessions' });

  it('covers the whole short challenge, marking past / today / future days', () => {
    // 14-day challenge from day 1, today = day 6
    const c = ctx({ now: at(6), finished: [wk(at(2), []), wk(at(2, 18), []), wk(at(6), [])] });
    const { byDay } = challengeProgress(ch(at(1), 14, 14), tmpl, c);
    expect(byDay).toHaveLength(14);
    expect(byDay.map((d) => d.state)).toEqual([
      ...Array(5).fill('past'),
      'today',
      ...Array(8).fill('future'),
    ]);
    // day 2 has two sessions (the busiest day) -> full intensity; day 6 one session -> half
    expect(byDay[1].intensity).toBe(1);
    expect(byDay[5].intensity).toBe(0.5);
    expect(byDay[0].intensity).toBe(0);
    for (let i = 1; i < byDay.length; i++) expect(byDay[i].ts - byDay[i - 1].ts).toBe(DAY);
  });

  it('long challenges show a trailing 28-day strip ending today', () => {
    const c = ctx({ now: at(1) + 40 * DAY });
    const { byDay } = challengeProgress(ch(at(1), 90, 100), tmpl, c);
    expect(byDay).toHaveLength(28);
    expect(byDay.at(-1)!.state).toBe('today');
    expect(byDay.filter((d) => d.state === 'future')).toHaveLength(0);
  });

  it('long challenge not yet 28 days in: strip starts at the challenge start and shows future days', () => {
    const { byDay } = challengeProgress(ch(at(1), 90, 100), tmpl, ctx({ now: at(3) }));
    expect(byDay).toHaveLength(28);
    expect(byDay.map((d) => d.state).slice(0, 4)).toEqual(['past', 'past', 'today', 'future']);
  });

  it('very short challenges still get a 7-day strip', () => {
    expect(challengeProgress(ch(at(1), 3, 3), tmpl, ctx({ now: at(2) })).byDay).toHaveLength(7);
  });

  it('intensity is normalised against the daily pace needed, and never exceeds 1', () => {
    // target 280 over 28 days = pace 10/day; one session = 0.1, but norm is max(1, maxDay, 10) = 10
    const one = challengeProgress(
      ch(at(1), 28, 280),
      tmpl,
      ctx({ now: at(5), finished: [wk(at(3), [])] }),
    );
    expect(one.byDay[2].intensity).toBe(0.1);
    const many = Array.from({ length: 12 }, (_, i) => wk(at(3, 6 + i), []));
    const busy = challengeProgress(ch(at(1), 28, 280), tmpl, ctx({ now: at(5), finished: many }));
    expect(busy.byDay[2].intensity).toBe(1);
  });

  it('reach and training-day challenges shade active days with a flag, whatever the amounts', () => {
    const c = ctx({ now: at(5), finished: [wk(at(3), []), wk(at(3, 18), [])] });
    for (const m of [{ kind: 'streak' }, { kind: 'trainingDays' }] as Metric[]) {
      const { byDay } = challengeProgress(ch(at(1), 14, 14), custom(m), c);
      expect(byDay[2].intensity).toBe(1);
      expect(byDay[1].intensity).toBe(0);
    }
  });
});
