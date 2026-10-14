import { describe, expect, it } from 'vitest';
import type { ClientHistory } from '../../domain/history';
import { WEEK, weekStartOf } from '../../domain/time';
import { FIXTURE_NOW, scheduleSeed } from '../../schedule/__fixtures__/fixtures';
import { generateSlots } from '../../schedule/model';
import { dayOfTs } from '../../schedule/time';
import { joinHistory } from './scheduleJoin';
import { historyFromWorkouts } from './worldMap';

const now = FIXTURE_NOW;
const sched = scheduleSeed();
const past = generateSlots(sched.docs, sched.requests, {
  fromDay: dayOfTs(weekStartOf(now) - 6 * WEEK),
  toDay: dayOfTs(weekStartOf(now)),
  now,
}).filter((s) => s.status !== 'moved' && s.attendees.length > 0);

const hist = (clientId: string, at: number[]): ClientHistory => ({
  lifts: [],
  sessions: [],
  weeks: [6, 5, 4, 3, 2, 1].map(() => ({ done: 0, planned: 0 })),
  workouts: {
    entries: at.map((a, i) => ({
      id: `w${i}`,
      at: a,
      title: 't',
      minutes: 50,
      sets: 3,
      tonnageKg: 100,
      withTrainer: false,
      pr: false,
      compliance: 100,
      exercises: [],
    })),
    exercises: [],
  },
  // clientId only names the call site
  ...(clientId ? {} : {}),
});

describe('joinHistory (the facts only the schedule knows)', () => {
  it('marks a logged session next to a scheduled 1:1 as with the trainer, and plans the weeks', () => {
    expect(past.length).toBeGreaterThan(0);
    const slot = past[0]!;
    const cid = slot.attendees[0]!.clientId;
    const out = joinHistory(
      { [cid]: hist(cid, [slot.start + 10 * 60_000, slot.start + 5 * 3_600_000]) },
      sched,
      now,
    );
    const e = out[cid]!.workouts!.entries;
    expect(e[0]!.withTrainer).toBe(true);
    expect(e[1]!.withTrainer).toBe(false);
    expect(out[cid]!.weeks.reduce((n, w) => n + w.planned, 0)).toBeGreaterThan(0);
  });
  it('without a schedule the history is returned untouched', () => {
    const h = { c: hist('c', [now]) };
    expect(joinHistory(h, null, now)).toBe(h);
  });
});

describe('historyFromWorkouts: PR flag', () => {
  const wk = (id: string, t: number, kg: number) =>
    ({
      id,
      startedAt: t,
      finishedAt: t + 3_000_000,
      exercises: [{ name: 'Squat', kind: 'strength', sets: [{ weight: kg, reps: 5 }] }],
    }) as never;
  it('flags only a session that beats every earlier best of the lift', () => {
    const d = 86_400_000;
    const h = historyFromWorkouts(
      [wk('a', now - 3 * d, 100), wk('b', now - 2 * d, 90), wk('c', now - d, 110)],
      now,
    );
    const byId = Object.fromEntries(h.workouts!.entries.map((e) => [e.id, e.pr]));
    expect(byId).toEqual({ a: false, b: false, c: true });
  });
});
