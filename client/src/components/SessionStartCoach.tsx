/**
 * Session-start coach. Shown at the very top of a live session while no
 * exercises have been added yet: a read on the day before the first set.
 *
 * Two parts, both grounded in real history:
 *  1. Readiness for the muscles you're about to train (predicted from this
 *     weekday's usual session), as one banner tinted by fatigue severity —
 *     green when they're recovered, amber mixed, red when a lot is still under.
 *  2. The lifts you usually do on this weekday, each with its progression read
 *     (add load / hold / deload / first time) — the same coaching the exercise
 *     cards show, previewed before you add them.
 */
import { Icon } from '../ui';
import { useT } from '../i18n';
import { MuscleIcon } from './Muscle';
import {
  muscleReadiness,
  READINESS_COLOR,
  type MuscleReadiness,
  type ReadyState,
} from '../recovery';
import { nextTarget, topHistory } from '../progression';
import { resolveMuscles, workoutDayReadout } from '../store';
import { dayReadoutLabel } from '../data/daySuggest';
import type { Workout, Exercise } from '../types';
import type { MuscleGroup } from '../data/exercises';

type T = ReturnType<typeof useT>['t'];
const round = (n: number): number => Math.round(n);
const fmtW = (kg: number): string => kg.toFixed(1);

/** The lifts + muscles you usually train on this weekday, newest same-day
 *  session first. Null when there's no same-weekday history to read from. */
function predictToday(
  finished: Workout[],
  now: number,
  t: T,
): { dayLabel: string | null; exercises: Exercise[]; muscles: MuscleGroup[] } | null {
  const dow = new Date(now).getDay();
  const sameDow = finished
    .filter((w) => new Date(w.startedAt).getDay() === dow)
    .sort((a, b) => b.startedAt - a.startedAt);
  if (sameDow.length === 0) return null;
  const recent = sameDow[0];
  const readout = workoutDayReadout(recent);
  const dayLabel = recent.dayName || (readout ? dayReadoutLabel(readout, t) : null);
  const exercises = [...recent.exercises]
    .sort((a, b) => a.position - b.position)
    .filter((e) => e.sets.length > 0);
  const seen = new Set<MuscleGroup>();
  const muscles: MuscleGroup[] = [];
  for (const e of exercises) {
    const { primary } = resolveMuscles(e);
    if (!primary || primary === 'cardio' || seen.has(primary)) continue;
    seen.add(primary);
    muscles.push(primary);
  }
  if (exercises.length === 0 && muscles.length === 0) return null;
  return { dayLabel, exercises, muscles };
}

/** Aggregate readiness of today's target muscles → the banner's tone. */
function severityOf(rows: MuscleReadiness[]): ReadyState {
  if (rows.length === 0) return 'ready';
  if (rows.some((r) => r.state === 'recovering')) return 'recovering';
  if (rows.some((r) => r.state === 'nearly')) return 'nearly';
  return 'ready';
}

/** Map the aggregate readiness state onto the shared banner tones. */
const TONE_BY_STATE: Record<ReadyState, string> = {
  recovering: 'analysis', // red — a lot still under, an easy day reads better
  nearly: 'plan', // amber-ish — mixed
  ready: 'suggest', // green — good to go
  stale: 'suggest',
};

function ExerciseTargetRow({
  ex,
  finished,
  now,
  t,
}: {
  ex: Exercise;
  finished: Workout[];
  now: number;
  t: T;
}) {
  const { primary } = resolveMuscles(ex);
  const target = nextTarget(topHistory(finished, ex.name, now), {
    plannedReps: ex.plannedReps,
    equipment: ex.equipment ?? [],
    primary,
  });
  const chip =
    target.state === 'progress' && target.deltaKg > 0 ? (
      <span className="ssc-chip up">
        <Icon name="arrow-up-right" weight="bold" />+{fmtW(target.deltaKg)}
      </span>
    ) : target.state === 'stall' ? (
      <span className="ssc-chip warn">{t.progDeload}</span>
    ) : target.state === 'first' ? (
      <span className="ssc-chip">{t.progFirst}</span>
    ) : (
      <span className="ssc-chip hold">{t.progHold}</span>
    );
  return (
    <div className="ssc-ex">
      <span className="ssc-ex-name">{ex.name}</span>
      {target.weight !== null && (
        <span className="ssc-ex-target tnum">
          {fmtW(target.weight)} × {target.reps}
        </span>
      )}
      {chip}
    </div>
  );
}

/** Whether the coach has anything to say — mirrors the null checks below, so the
 *  session screen can show an "open" button only when the sheet won't be empty. */
export function hasSessionStartCoach(finished: Workout[], now: number): boolean {
  if (finished.length < 2) return false;
  const dow = new Date(now).getDay();
  const sameDow = finished
    .filter((w) => new Date(w.startedAt).getDay() === dow)
    .sort((a, b) => b.startedAt - a.startedAt);
  if (sameDow.length === 0) return false;
  // The coach renders when the most-recent same-weekday session had any logged
  // exercises (its muscles are derived from those, so no exercises = nothing).
  return sameDow[0].exercises.some((e) => e.sets.length > 0);
}

export function SessionStartCoach({ finished, now }: { finished: Workout[]; now: number }) {
  const { t } = useT();
  if (finished.length < 2) return null;
  const plan = predictToday(finished, now, t);
  if (!plan) return null;

  const map = muscleReadiness(finished, now);
  const rows = plan.muscles.map((m) => map.get(m)).filter((r): r is MuscleReadiness => !!r);
  const severity = severityOf(rows);
  const tone = TONE_BY_STATE[severity];
  const recovering = rows
    .filter((r) => r.state === 'recovering' || r.state === 'nearly')
    .map((r) => t.muscleGroups[r.muscle]);
  const lead =
    severity === 'recovering'
      ? t.rdCookedLead
      : severity === 'nearly'
        ? t.rdMixedBare
        : t.rdFreshLead;

  return (
    <div className="ssc">
      <div className={`ssc-read tone-${tone}`}>
        <div className="ssc-read-head">
          <span className="ssc-ic">
            <Icon name="heartbeat" weight="fill" />
          </span>
          <span className="ssc-kicker">{t.readinessKicker}</span>
        </div>
        <div className="ssc-lead">{lead}</div>
        {rows.length > 0 && (
          <div className="ssc-strip">
            {rows.map((r) => (
              <span key={r.muscle} className="ssc-m">
                <MuscleIcon muscle={r.muscle} variant="row" tone="primary" />
                <span className="ssc-m-name">{t.muscleGroups[r.muscle]}</span>
                <span className="ssc-m-pct tnum" style={{ color: READINESS_COLOR[r.state] }}>
                  {round(r.readiness * 100)}%
                </span>
              </span>
            ))}
          </div>
        )}
        {recovering.length > 0 && severity !== 'ready' && (
          <div className="ssc-why">{t.rdCoolingWhy(recovering.join(' · '))}</div>
        )}
      </div>

      {plan.exercises.length > 0 && (
        <div className="ssc-plan">
          <div className="ssc-plan-head">
            <Icon name="calendar-check" weight="fill" />
            <span>{plan.dayLabel ? t.likelyDayTitle(plan.dayLabel) : t.likelyToday}</span>
          </div>
          <div className="ssc-ex-list">
            {plan.exercises.slice(0, 6).map((ex) => (
              <ExerciseTargetRow key={ex.id} ex={ex} finished={finished} now={now} t={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
