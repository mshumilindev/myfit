/**
 * The only data Gemini sees: a compact summary computed from the user's log —
 * no name, no email, no birth date, no photos. Hard tempers don't even get
 * bodyweight (the body is off-limits for them anyway).
 */
import type { StoreState } from '../store';
import { est1rm, setTopWeight, topSet, setTypeOf } from '../store';
import { activeInjuries } from '../injury';
import { finishedNights, nightDurationMin } from '../sleep';
import { latestWeight } from '../store';
import { blockWeek, planDayFor } from './plan';
import type { AtlasNote } from './notes';
import type { Temper } from './types';
import { describeMemory } from './memory';

/**
 * Every lift you've ever logged, over your WHOLE history (not just the recent
 * sessions): so "how are my pull-ups going" is answerable even if you last did
 * them two months ago. Bodyweight lifts are measured in reps, loaded ones in
 * estimated max (kg). Most-logged first, capped to keep the prompt small.
 */
function liftHistory(
  finished: {
    startedAt: number;
    exercises: { name: string; sets: Parameters<typeof setTypeOf>[0][] }[];
  }[],
) {
  const by = new Map<string, { ts: number; kg: number; reps: number; e1: number }[]>();
  for (const w of [...finished].reverse())
    for (const e of w.exercises) {
      const work = e.sets.filter((x) => setTypeOf(x) !== 'warmup' && x.reps > 0);
      if (!work.length) continue;
      const best = work
        .map((x) => {
          const kg = setTopWeight(x);
          return {
            ts: w.startedAt,
            kg,
            reps: x.reps,
            e1: kg > 0 ? est1rm(kg, Math.min(12, x.reps)) : 0,
          };
        })
        .sort((a, b) => b.e1 - a.e1 || b.reps - a.reps)[0];
      (by.get(e.name) ?? by.set(e.name, []).get(e.name)!).push(best);
    }
  return [...by.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 30)
    .map(([name, pts]) => {
      const bw = pts.filter((p) => p.kg === 0).length >= pts.length / 2;
      const series = pts.filter((p) => (p.kg === 0) === bw);
      const score = (p: (typeof pts)[number]) => (bw ? p.reps : Math.round(p.e1 * 2) / 2);
      const first = series[0];
      const last = series[series.length - 1];
      const top = series.reduce((a, b) => (score(b) > score(a) ? b : a), first);
      return {
        name,
        measuredIn: bw ? 'reps (bodyweight)' : 'estimated 1RM kg',
        sessions: pts.length,
        firstDate: iso(pts[0].ts),
        lastDate: iso(pts[pts.length - 1].ts),
        first: score(first),
        last: score(last),
        best: score(top),
        bestSet: bw ? `${top.reps} reps` : `${top.kg} kg x ${top.reps}`,
      };
    });
}

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
    // Whole history per lift — use this for "how is X going" questions.
    allLifts: liftHistory(finished),
    yourRecentNotes: notes.slice(-8).map((n) => n.text),
    injuredMuscles: activeInjuries(s.injuries).flatMap((i) => i.muscles ?? []),
    lastNightSleepH: night ? Math.round((nightDurationMin(night, now) / 60) * 10) / 10 : null,
    bodyweightKg: temper < 4 ? (latestWeight(s.bodyMetrics)?.weight ?? null) : undefined,
  };
  return JSON.stringify(facts);
}
