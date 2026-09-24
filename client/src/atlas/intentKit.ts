/**
 * Shared kit for Atlas's answer base: context, parsed question, helpers.
 */
import type { StoreState } from '../store';
import { setTypeOf } from '../store';
import type { LocaleId } from '../i18n';
import type { MuscleGroup } from '../data/exercises';
import { muscleReadiness } from '../recovery';
import { VOLUME_MUSCLES } from '../volume';
import { computePlaybook, playForWeekday } from '../playbook';
import { planDayFor } from './plan';
import type { Fmt } from './voice';
import type { Temper } from './types';

export const DAY = 86_400_000;
export const WEEK = 7 * DAY;

export interface AskCtx {
  s: Pick<
    StoreState,
    'workouts' | 'coach' | 'injuries' | 'sleeps' | 'bodyMetrics' | 'restPeriods' | 'exerciseRest'
  > &
    Partial<Pick<StoreState, 'activities' | 'gyms' | 'goals'>>;
  now: number;
  locale: LocaleId;
  temper: Temper;
  fmt: Fmt;
}

export interface Parsed {
  words: string[];
  phrase: string;
  exercise: string | null;
  muscle: MuscleGroup | null;
}

export type Tr = (en: string, uk: string) => string;

export interface Intent {
  id: string;
  /** Keyword groups — every group must match. */
  all: string[][];
  /** Needs a lift / a muscle in the question. */
  needs?: 'exercise' | 'muscle';
  /** Only for short messages (greetings, "ok"). */
  maxWords?: number;
  /** Spoken plainly in every temper (pain, bodyweight). */
  neutral?: boolean;
  /** Wins over everything else when it matches (pain). */
  priority?: boolean;
  answer: (c: AskCtx, p: Parsed, L: Tr) => string | null;
  /** "Why?" right after this answer — where the answer comes from. */
  why?: (c: AskCtx, p: Parsed, L: Tr) => string | null;
  /** Follow-up questions offered as chips under the answer. */
  suggest?: (L: Tr) => string[];
  /** Pain / illness intents: skipped when the words are negated ("no pain"). */
  negatable?: boolean;
}

// ---- helpers ----------------------------------------------------------------

export function finishedOf(c: AskCtx) {
  return c.s.workouts
    .filter((w) => w.finishedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt);
}
export const wd = (c: AskCtx, weekday: number) =>
  new Intl.DateTimeFormat(c.locale, { weekday: 'long' }).format(new Date(2026, 0, 4 + weekday));
export const date = (c: AskCtx, ts: number) => new Date(ts).toLocaleDateString(c.locale);

export function loggedLifts(c: AskCtx): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const w of c.s.workouts)
    for (const e of w.exercises)
      if (e.sets.some((x) => setTypeOf(x) !== 'warmup'))
        counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count }));
}

export function todayLine(c: AskCtx, L: Tr, at: number): string {
  const plan = c.s.coach.enabled && c.s.coach.role === 'main' ? c.s.coach.plan : null;
  if (plan) {
    const day = planDayFor(plan, at);
    if (!day) return L('Rest day in your plan.', 'За планом — день відпочинку.');
    const ms = day.muscles.map((m) => c.fmt.muscle(m)).join(', ');
    return `${day.name ?? day.split}: ${ms}.`;
  }
  const finished = finishedOf(c);
  const play = playForWeekday(computePlaybook(finished, at).plays, new Date(at).getDay());
  if (play) {
    const ms = play.coverage.filter((x) => x.primary).map((x) => c.fmt.muscle(x.muscle));
    const lifts = play.exercises
      .slice(0, 4)
      .map((e) => c.fmt.exercise(e.name))
      .join(', ');
    return L(
      `Usually ${play.name ?? ms.join(' + ')} on this day: ${lifts}.`,
      `Зазвичай цього дня ${play.name ?? ms.join(' + ')}: ${lifts}.`,
    );
  }
  const ready = muscleReadiness(finished, at);
  const fresh = VOLUME_MUSCLES.filter((m) => {
    const r = ready.get(m);
    return !r || r.state === 'ready' || r.state === 'stale';
  })
    .slice(0, 3)
    .map((m) => c.fmt.muscle(m))
    .join(', ');
  return L(`Fresh today: ${fresh}. Train those.`, `Сьогодні свіжі: ${fresh}. Їх і тренуй.`);
}
