/**
 * Today's session from Atlas's programme — only when he is the main coach and
 * today is one of the plan's training days. Built with the regular session
 * builder (recovery, injuries, gym, progression), same as a hand-built day.
 */
import { useMemo } from 'react';
import { latestWeight, pickSessionGym, useStore } from '../store';
import { loadCaps, protectedMuscles } from '../injury';
import { buildPlanDay, planDayFor, type CoachPlanDay } from './plan';
import type { GeneratedDay } from '../sessionBuilder';

export interface TodayPlan {
  day: CoachPlanDay;
  built: GeneratedDay;
}

export function useTodayPlan(now: number, excludeWorkoutId?: string): TodayPlan | null {
  const s = useStore();
  const plan = s.coach.enabled && s.coach.role === 'main' ? (s.coach.plan ?? null) : null;
  return useMemo(() => {
    if (!plan || now <= 0) return null;
    const day = planDayFor(plan, now);
    if (!day) return null;
    const finished = s.workouts.filter((w) => w.finishedAt !== null && w.id !== excludeWorkoutId);
    const built = buildPlanDay(plan, day, {
      finished,
      activities: s.activities,
      body: s.bodyMetrics,
      goals: s.goals,
      gym: pickSessionGym(),
      now,
      intent: 'muscle',
      protectedMuscles: [...protectedMuscles(s.injuries)],
      loadCaps: loadCaps(s.injuries),
      bodyKg: latestWeight(s.bodyMetrics)?.weight ?? null,
      sex: s.bodyMetrics.sex,
    });
    return built.main.length ? { day, built } : null;
  }, [plan, now, s.workouts, s.activities, s.bodyMetrics, s.goals, s.injuries, excludeWorkoutId]);
}
