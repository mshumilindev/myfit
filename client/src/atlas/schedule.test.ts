import { describe, expect, it } from 'vitest';
import type { Workout } from '../types';
import { chatBacked, planOutbox } from './schedule';
import { noteFromHash } from './noteLink';
import { buildNotes } from './notes';
import { setWeekStartDay } from '../weekStart';
import { proposePlan } from './plan';
import { COACH_DEFAULT } from './types';
import type { Fmt } from './voice';

const DAY = 86_400_000;
const WED_NOON = new Date(2026, 9, 7, 12).getTime();
const fmt: Fmt = {
  kg: (k) => `${k} kg`,
  mmss: (s) => `${s}s`,
  muscle: (m) => m,
  exercise: (e) => e,
};
const session = (at: number): Workout =>
  ({
    id: `w${at}`,
    startedAt: at,
    finishedAt: at + 3600_000,
    gymId: null,
    exercises: [],
  }) as unknown as Workout;

const base = {
  temper: 5 as const,
  plays: [],
  now: WED_NOON,
  locale: 'en' as const,
  fmt,
  title: 'Atlas',
  reviewBody: 'Your week is in.',
};

describe('planOutbox', () => {
  it('nudges on a planned day after your usual start, and books the Sunday review', () => {
    // Usually trains Wednesdays at 18:00.
    const hist = [1, 2, 3].map((w) => session(new Date(2026, 9, 7 - 7 * w, 18).getTime()));
    const plan = proposePlan({ finished: hist, plays: [], now: WED_NOON, weekdays: [3] });
    const msgs = planOutbox({
      ...base,
      finished: hist,
      coach: { ...COACH_DEFAULT, enabled: true, plan },
    });
    const skipped = msgs.find((m) => m.id.startsWith('skipped-'));
    expect(new Date(skipped!.dueAt).getHours()).toBe(20);
    const review = msgs.find((m) => m.id.startsWith('review-'))!;
    expect(new Date(review.dueAt).getDay()).toBe(0);
    expect(new Date(review.dueAt).getHours()).toBe(19);
  });

  it('says nothing about a day you already trained, or when Atlas is off', () => {
    const plan = proposePlan({ finished: [], plays: [], now: WED_NOON, weekdays: [3] });
    const today = [session(WED_NOON - 2 * 3600_000)];
    const msgs = planOutbox({
      ...base,
      finished: today,
      coach: { ...COACH_DEFAULT, enabled: true, plan },
    });
    expect(msgs.some((m) => m.id.startsWith('skipped-'))).toBe(false);
    expect(
      planOutbox({ ...base, finished: [], coach: { ...COACH_DEFAULT, enabled: false } }),
    ).toEqual([]);
  });

  it('never nudges after 21:00', () => {
    const late = [1, 2, 3].map((w) => session(new Date(2026, 9, 7 - 7 * w, 20, 30).getTime()));
    const plan = proposePlan({ finished: late, plays: [], now: WED_NOON, weekdays: [3] });
    const m = planOutbox({
      ...base,
      finished: late,
      coach: { ...COACH_DEFAULT, enabled: true, plan },
    }).find((x) => x.id.startsWith('skipped-'))!;
    expect(new Date(m.dueAt).getHours()).toBe(21);
    expect(m.dueAt - WED_NOON).toBeLessThan(DAY);
  });
});

// SPO-21: every notification from Atlas has its message in the chat.
describe('pushes are backed by chat notes', () => {
  const hist = [1, 2, 3].map((w) => session(new Date(2026, 9, 7 - 7 * w, 18).getTime()));
  const plan = proposePlan({ finished: hist, plays: [], now: WED_NOON, weekdays: [3] });
  const coach = { ...COACH_DEFAULT, enabled: true, plan, startedAt: WED_NOON - 40 * DAY };
  const store = (workouts: Workout[]) =>
    ({
      workouts,
      sleeps: [],
      bodyMetrics: null,
      injuries: [],
      restPeriods: [],
      coach,
    }) as unknown as Parameters<typeof buildNotes>[0];
  const notesFor = (workouts: Workout[]) => (t: number) =>
    buildNotes(store(workouts), t, 'en', fmt).notes;

  it('a planned-day nudge (no playbook play) has its "skipped" note at the push time', () => {
    const msgs = planOutbox({ ...base, finished: hist, coach });
    const skipped = msgs.find((m) => m.id.startsWith('skipped-'))!;
    expect(skipped.noteId).toBeDefined();
    expect(chatBacked(msgs, notesFor(hist)).some((m) => m.id === skipped.id)).toBe(true);
  });

  it('the review goes out on the last day of the training week, and only when its note will exist', () => {
    const review = (finished: Workout[]) =>
      chatBacked(planOutbox({ ...base, finished, coach }), notesFor(finished)).find((m) =>
        m.id.startsWith('review-'),
      );
    // Monday start: week ends Sunday. Nothing logged and nothing usual: no note, no push.
    expect(review([])).toBeUndefined();
    expect(new Date(review(hist)!.dueAt).getDay()).toBe(0);
    setWeekStartDay(7); // Sunday start: the week ends on Saturday
    try {
      expect(new Date(review(hist)!.dueAt).getDay()).toBe(6);
    } finally {
      setWeekStartDay(1);
    }
  });
});

describe('notification → chat message link (SPO-21)', () => {
  it('every planned push that announces a chat note links to exactly that note', () => {
    const hist = [1, 2, 3].map((w) => session(new Date(2026, 9, 7 - 7 * w, 18).getTime()));
    const plan = proposePlan({ finished: hist, plays: [], now: WED_NOON, weekdays: [3] });
    const msgs = planOutbox({
      ...base,
      finished: hist,
      coach: { ...COACH_DEFAULT, enabled: true, plan },
    });
    const backed = msgs.filter((m) => m.noteId);
    expect(backed.length).toBeGreaterThan(0);
    for (const m of backed) {
      const hash = m.url.replace(/^\//, '');
      expect(hash.startsWith('#/coach?')).toBe(true);
      expect(noteFromHash(hash)).toBe(m.noteId);
    }
  });

  it('noteFromHash reads the id, and nothing from a plain chat hash', () => {
    expect(noteFromHash('#/coach?note=skipped%3A20000')).toBe('skipped:20000');
    expect(noteFromHash('#/coach')).toBeNull();
    expect(noteFromHash('#/coach?x=1')).toBeNull();
  });
});
