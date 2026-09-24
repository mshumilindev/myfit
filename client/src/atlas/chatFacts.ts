/**
 * The only data Gemini sees: a compact summary computed from the user's log —
 * no name, no email, no birth date, no photos. Hard tempers don't even get
 * bodyweight (the body is off-limits for them anyway).
 */
import type { StoreState } from '../store';
import { setTopWeight, topSet, setTypeOf } from '../store';
import { activeInjuries } from '../injury';
import { finishedNights, nightDurationMin } from '../sleep';
import { latestWeight } from '../store';
import { blockWeek, planDayFor } from './plan';
import type { AtlasNote } from './notes';
import type { Temper } from './types';
import { describeMemory } from './memory';

const iso = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function buildChatFacts(
  s: Pick<StoreState, 'workouts' | 'coach' | 'injuries' | 'sleeps' | 'bodyMetrics'>,
  notes: AtlasNote[],
  temper: Temper,
  now: number,
): string {
  const finished = s.workouts
    .filter((w) => w.finishedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt);
  const sessions = finished.slice(0, 8).map((w) => ({
    date: iso(w.startedAt),
    day: w.dayName ?? null,
    minutes: Math.round(((w.finishedAt ?? w.startedAt) - w.startedAt) / 60000),
    lifts: w.exercises
      .filter((e) => e.sets.some((x) => setTypeOf(x) !== 'warmup'))
      .map((e) => {
        const top = topSet(e.sets);
        const work = e.sets.filter((x) => setTypeOf(x) !== 'warmup');
        return {
          name: e.name,
          sets: work.length,
          reps: work.map((x) => x.reps),
          topKg: top ? setTopWeight(top) : null,
          restTargetSec: work.find((x) => x.restTargetSec)?.restTargetSec ?? null,
        };
      }),
  }));
  const plan = s.coach.plan ?? null;
  const night = finishedNights(s.sleeps, now)[0];
  const facts = {
    today: iso(now),
    weekday: new Date(now).toLocaleDateString('en', { weekday: 'long' }),
    role: s.coach.role,
    // What the athlete told Atlas before — Gemini must not contradict it.
    athleteToldMe: describeMemory(
      s.coach.memory,
      now,
      (en) => en,
      (n) => n,
    ),
    plan: plan
      ? {
          week: blockWeek(plan, now),
          of: plan.weeks,
          lastWeekIsLighter: true,
          lengthMin: plan.lengthMin,
          days: plan.days.map((d) => ({
            weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.weekday],
            split: d.name ?? d.split,
            muscles: d.muscles,
          })),
          today: planDayFor(plan, now)?.split ?? 'rest',
        }
      : null,
    sessionsTotal: finished.length,
    recentSessions: sessions,
    yourRecentNotes: notes.slice(-8).map((n) => n.text),
    injuredMuscles: activeInjuries(s.injuries).flatMap((i) => i.muscles ?? []),
    lastNightSleepH: night ? Math.round((nightDurationMin(night, now) / 60) * 10) / 10 : null,
    bodyweightKg: temper < 4 ? (latestWeight(s.bodyMetrics)?.weight ?? null) : undefined,
  };
  return JSON.stringify(facts);
}
