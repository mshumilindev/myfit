import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t as currentT } from './i18n';
import { __getStateForTests, __replaceStateForTests, getStoreState } from './store';
import type { ActiveChallenge } from './challenges';
import type { Exercise, SetEntry, Workout } from './types';
import {
  computeNotifs,
  loadNotifState,
  markAllSeen,
  markSeen,
  notifTime,
  reconcileNotifs,
  saveNotifState,
  isSeen,
  unreadCount,
  type Notif,
  type NotifState,
} from './notifications';

setLocale('en');
const t = currentT();
const NOW = new Date(2026, 5, 15, 12).getTime(); // Mon 15 Jun 2026, local noon
const DAY = 86_400_000;

const set = (weight: number, reps = 5, extra: Partial<SetEntry> = {}): SetEntry => ({
  id: `s${weight}`,
  reps,
  weight,
  isWarmup: false,
  position: 0,
  ...extra,
});
const ex = (name: string, sets: SetEntry[], extra: Partial<Exercise> = {}): Exercise =>
  ({ id: `e-${name}`, name, position: 0, sets, ...extra }) as Exercise;
const wk = (id: string, daysAgo: number, exercises: Exercise[]): Workout => {
  const startedAt = NOW - daysAgo * DAY;
  return {
    id,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    autoFinished: false,
    exercises,
  } as unknown as Workout;
};
const seed = (workouts: Workout[], extra: Record<string, unknown> = {}) =>
  __replaceStateForTests({ ...__getStateForTests(), workouts, activities: [], ...extra });
const compute = (challenges: ActiveChallenge[] = []) =>
  computeNotifs(getStoreState(), NOW, t, challenges);

let backup: StoreSnapshot;
type StoreSnapshot = ReturnType<typeof __getStateForTests>;
beforeEach(() => {
  backup = __getStateForTests();
  localStorage.clear();
});
afterEach(() => __replaceStateForTests(backup));

describe('computeNotifs: personal records', () => {
  it('a heavier top set than any earlier session is a PR; the first session only sets the bar', () => {
    seed([
      wk('a', 10, [ex('Bench Press', [set(80)])]),
      wk('b', 5, [ex('Bench Press', [set(80)])]), // equal: not a record
      wk('c', 2, [ex('bench press', [set(85)])]), // +5, name matched case-insensitively
    ]);
    const prs = compute().filter((n) => n.kind === 'pr');
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({
      id: 'pr:bench press:c',
      title: 'bench press PR',
      nav: '#/exercise/bench%20press',
    });
    expect(prs[0].subtitle).toContain('up');
    expect(prs[0].subtitle.endsWith(t.notifPrUp('5 kg'))).toBe(true);
  });

  it('uses the logged-at time of the top set when present', () => {
    const at = NOW - 3 * DAY + 12345;
    seed([
      wk('a', 10, [ex('Row', [set(60)])]),
      wk('b', 3, [ex('Row', [set(70, 5, { loggedAt: at })])]),
    ]);
    expect(compute().find((n) => n.kind === 'pr')!.ts).toBe(at);
  });

  it('ignores assist and band exercises, warm-ups and bodyweight (0 kg) sets', () => {
    seed(
      [
        wk('a', 10, [
          ex('Pull-up', [set(10)]),
          ex('Band Pull', [set(10)]),
          ex('Squat', [set(100)]),
        ]),
        wk('b', 2, [
          ex('Pull-up', [set(20)]),
          ex('Band Pull', [set(20)]),
          ex('Squat', [set(300, 5, { isWarmup: true }), set(100)]),
          ex('Dips', [set(0, 10)]),
        ]),
      ],
      { exerciseLoadTypes: { 'Pull-up': 'assist', 'Band Pull': 'band' } },
    );
    expect(compute().filter((n) => n.kind === 'pr')).toEqual([]);
  });

  it('skips cardio entries and unfinished workouts', () => {
    const live = {
      ...wk('live', 1, [ex('Squat', [set(200)])]),
      finishedAt: null,
    } as unknown as Workout;
    seed([
      wk('a', 10, [ex('Squat', [set(100)])]),
      live,
      wk('c', 2, [ex('Squat', [set(500)], { kind: 'cardio' } as Partial<Exercise>)]),
    ]);
    expect(compute().filter((n) => n.kind === 'pr')).toEqual([]);
  });
});

describe('computeNotifs: feed shape', () => {
  it('is empty without workouts or completed challenges', () => {
    seed([]);
    expect(compute()).toEqual([]);
    expect(
      compute([{ id: 'x', templateId: 'sessions', status: 'active' } as ActiveChallenge]),
    ).toEqual([]);
  });

  it('lists only done challenges whose template exists, falling back to now for the date', () => {
    seed([]);
    const done = (id: string, templateId: string, completedAt?: number | null): ActiveChallenge =>
      ({
        id,
        templateId,
        startedAt: NOW - 9 * DAY,
        endsAt: NOW,
        target: 12,
        status: 'done',
        completedAt,
      }) as ActiveChallenge;
    const out = compute([
      done('c1', 'sessions', NOW - DAY),
      done('c2', 'no-such-template'),
      done('c3', 'sessions', null),
      { ...done('c4', 'sessions'), status: 'given-up' },
    ]);
    expect(out.map((n) => [n.id, n.ts])).toEqual([
      ['challenge:c3', NOW],
      ['challenge:c1', NOW - DAY],
    ]);
    expect(out[0]).toMatchObject({ kind: 'challenge', nav: '#/apex/challenges' });
    expect(out[0].title.startsWith('Challenge done:')).toBe(true);
  });

  it('is sorted newest first and carries standards / feats for a lifter with history', () => {
    seed([
      wk('a', 30, [ex('Bench Press', [set(60)])]),
      wk('b', 2, [ex('Bench Press', [set(100)])]),
    ]);
    const out = compute();
    expect(out.map((n) => n.ts)).toEqual([...out.map((n) => n.ts)].sort((a, b) => b - a));
    const kinds = new Set(out.map((n) => n.kind));
    expect(kinds.has('pr')).toBe(true);
    for (const n of out.filter((x) => x.kind === 'standard')) {
      expect(n.id.startsWith('std:')).toBe(true);
      expect(n.nav).toMatch(/^#\/apex\/ranks\?f=std-/);
      expect(n.title).toContain(' → ');
    }
    for (const n of out.filter((x) => x.kind === 'feat')) {
      expect(n.nav).toMatch(/^#\/apex\/awards\?f=feat-/);
      expect(n.subtitle).toBe(t.notifFeatSub);
    }
    // ids are unique: the inbox keys its read-state by id
    expect(new Set(out.map((n) => n.id)).size).toBe(out.length);
  });

  it('caps the feed at 400 events', () => {
    seed([]);
    const many = Array.from(
      { length: 450 },
      (_, i) =>
        ({
          id: `c${i}`,
          templateId: 'sessions',
          startedAt: 0,
          endsAt: 0,
          target: 5,
          status: 'done',
          completedAt: i,
        }) as ActiveChallenge,
    );
    const out = compute(many);
    expect(out).toHaveLength(400);
    expect(out[0].id).toBe('challenge:c449');
    expect(out[399].id).toBe('challenge:c50');
  });
});

describe('computeNotifs: streak milestone', () => {
  const daily = (n: number) =>
    Array.from({ length: n }, (_, i) => wk(`d${i}`, i, [ex('Squat', [set(100)])]));

  it('no streak notification below 7 days', () => {
    seed(daily(6));
    expect(compute().some((n) => n.kind === 'streak')).toBe(false);
  });

  it('posts the highest milestone reached', () => {
    seed(daily(7));
    const s = compute().find((n) => n.kind === 'streak')!;
    expect(s.id).toBe('streak:7');
    expect(s.title).toBe(t.notifStreakTitle(7));
    seed(daily(15));
    expect(compute().find((n) => n.kind === 'streak')!.id).toBe('streak:14');
  });
});

describe('notifTime', () => {
  const at = (ms: number) => notifTime(NOW - ms, NOW, t, 'en');
  it('walks through the relative buckets at their boundaries', () => {
    expect(at(0)).toBe(t.justNow);
    expect(at(59_999)).toBe(t.justNow);
    expect(at(60_000)).toBe(t.minAgo(1));
    expect(at(3_599_999)).toBe(t.minAgo(60));
    expect(at(3_600_000)).toBe('1h');
    expect(at(6 * 3_600_000 - 1)).toBe('6h');
  });
  it('switches to weekday under a week and a short date after', () => {
    const sixH = NOW - 6 * 3_600_000;
    expect(notifTime(sixH, NOW, t, 'en')).toBe('Monday');
    expect(notifTime(NOW - 6 * DAY, NOW, t, 'en')).toBe('Tuesday');
    expect(notifTime(NOW - 7 * DAY, NOW, t, 'en')).toBe('JUN 08');
  });
  it('formats in the requested locale', () => {
    expect(notifTime(NOW - 7 * DAY, NOW, t, 'uk')).not.toBe('JUN 08');
    expect(notifTime(NOW - 7 * DAY, NOW, t, 'uk')).toMatch(/8/);
  });
  it('a timestamp in the future still reads as just now', () => {
    expect(notifTime(NOW + 5 * 60_000, NOW, t, 'en')).toBe(t.justNow);
  });
});

const n = (id: string, ts: number): Notif => ({ id, kind: 'pr', ts, title: id, subtitle: '' });

describe('persisted read-state', () => {
  it('round-trips through localStorage and tolerates garbage / unavailable storage', () => {
    expect(loadNotifState()).toEqual({});
    saveNotifState({ a: { ts: 1, seen: true } });
    expect(loadNotifState()).toEqual({ a: { ts: 1, seen: true } });
    localStorage.setItem('spotter.notif.state', '{broken');
    expect(loadNotifState()).toEqual({});
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveNotifState({})).not.toThrow();
    set.mockRestore();
  });
});

describe('reconcileNotifs', () => {
  it('first run baselines everything as read; later runs mark new ids unread', () => {
    const first = reconcileNotifs([n('a', 5)], {}, true);
    expect(first.state).toEqual({ a: { ts: 5, seen: true } });
    const next = reconcileNotifs([n('a', 5), n('b', 9)], first.state, false);
    expect(next.state).toEqual({ a: { ts: 5, seen: true }, b: { ts: 9, seen: false } });
  });

  it('freezes the timestamp at first sight and sorts newest first', () => {
    const prev: NotifState = { a: { ts: 100, seen: false } };
    const r = reconcileNotifs([n('a', 999), n('b', 500)], prev, false);
    expect(r.notifs.map((x) => [x.id, x.ts])).toEqual([
      ['b', 500],
      ['a', 100],
    ]);
  });

  it('drops state of events that disappeared from the feed', () => {
    const r = reconcileNotifs(
      [n('a', 1)],
      { a: { ts: 1, seen: false }, gone: { ts: 2, seen: true } },
      false,
    );
    expect(Object.keys(r.state)).toEqual(['a']);
  });

  it('caps the feed at 120 and keeps the newest 1000 records', () => {
    const raw = Array.from({ length: 1100 }, (_, i) => n(`e${i}`, i));
    const r = reconcileNotifs(raw, {}, false);
    expect(Object.keys(r.state)).toHaveLength(1000);
    expect(r.state['e99']).toBeUndefined();
    expect(r.state['e100']).toBeDefined();
    expect(r.notifs).toHaveLength(120);
    expect(r.notifs[0].id).toBe('e1099');
    expect(r.notifs[119].id).toBe('e980');
  });
});

describe('seen helpers', () => {
  const state: NotifState = { a: { ts: 1, seen: false }, b: { ts: 2, seen: true } };
  it('markSeen flips only the given known unread ids and returns the same object when nothing changed', () => {
    const r = markSeen(state, ['a', 'zzz']);
    expect(r).toEqual({ a: { ts: 1, seen: true }, b: { ts: 2, seen: true } });
    expect(state.a.seen).toBe(false); // input not mutated
    expect(markSeen(state, ['b', 'zzz'])).toBe(state);
    expect(markSeen(state, [])).toBe(state);
  });
  it('markAllSeen reads everything; identity when already all read', () => {
    const r = markAllSeen(state);
    expect(r.a.seen && r.b.seen).toBe(true);
    expect(markAllSeen(r)).toBe(r);
    expect(markAllSeen({})).toEqual({});
  });
  it('unreadCount / isSeen treat unknown ids as unread', () => {
    const feed = [n('a', 1), n('b', 2), n('c', 3)];
    expect(unreadCount(state, feed)).toBe(2);
    expect(isSeen(state, 'b')).toBe(true);
    expect(isSeen(state, 'a')).toBe(false);
    expect(isSeen(state, 'nope')).toBe(false);
  });
});
