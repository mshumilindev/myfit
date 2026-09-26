/**
 * A muscle's state right now, shown inside the muscle drawer when a chip is
 * tapped in the live session:
 * the readiness read behind the chip's dot (and what it means), how much hard
 * work it has had today and what one more set is still worth, the week's sets
 * against its personal targets, the week's fatigue and when it last worked
 * hard. The drawer's own button still opens the full history.
 */
import { useMemo, useState } from 'react';
import { useT } from '../i18n';
import { useStore } from '../store';
import type { Workout } from '../types';
import type { MuscleGroup } from '../data/exercises';
import { directReadiness } from '../picker';
import { READINESS_COLOR } from '../recovery';
import { marginalStimulus } from '../stimulus';
import { weeklyMuscleSets, LANDMARKS } from '../volume';
import { cachedPersonalLandmarks } from '../personalize';
import { muscleFatigue, FATIGUE_COLOR } from '../fatigue';

export function MuscleStatePanel({
  muscle,
  workout,
  todaySets,
  plateau,
}: {
  muscle: MuscleGroup;
  /** The live session (its sets count toward today's read). */
  workout: Workout;
  /** Fractional hard sets the muscle has had in this session. */
  todaySets: number;
  /** Personal per-session plateau for the muscle. */
  plateau: number;
}) {
  const { t } = useT();
  const store = useStore();
  const [now] = useState(() => Date.now());

  const read = useMemo(() => {
    const finished = store.workouts.filter((w) => w.finishedAt !== null && w.id !== workout.id);
    const withToday = [...finished, workout];
    const state = directReadiness([muscle], muscle, withToday, now);
    const before = directReadiness([muscle], muscle, finished, now);
    const week = weeklyMuscleSets(withToday, now, 7).get(muscle) ?? 0;
    const lm = cachedPersonalLandmarks(store.workouts, now).get(muscle) ?? LANDMARKS[muscle];
    const fat = muscleFatigue(withToday, now).get(muscle) ?? null;
    return { state, before, week, lm, fat };
  }, [store.workouts, workout, muscle, now]);

  const worth = Math.round(marginalStimulus(todaySets, plateau) * 100);
  // The readiness read counts direct (primary) work only; a muscle worked
  // today as a helper is still not "stale" — call it nearly recovered.
  const state = read.state.state === 'stale' && todaySets > 0 ? 'nearly' : read.state.state;
  const color = READINESS_COLOR[state];

  return (
    <div className="mss">
      <div className="mss-state" style={{ ['--rc' as string]: color }}>
        <span className="mss-dot" aria-hidden />
        <div>
          <div className="mss-state-t">{t.rdState[state]}</div>
          <div className="mss-state-s">{t.msStateNote[state]}</div>
        </div>
      </div>
      <div className="mss-grid">
        <div className="mss-tile">
          <span className="mss-v num">{todaySets.toFixed(1)}</span>
          <span className="mss-l">{t.msToday}</span>
        </div>
        <div className="mss-tile">
          <span className="mss-v num">{worth}%</span>
          <span className="mss-l">{t.msNextWorth}</span>
        </div>
        <div className="mss-tile">
          <span className="mss-v num">{Math.round(read.week * 10) / 10}</span>
          <span className="mss-l">
            {t.msWeek}
            {read.lm ? ` · ${t.msWeekTarget(read.lm.mev, read.lm.mav)}` : ''}
          </span>
        </div>
        <div className="mss-tile">
          <span
            className="mss-v"
            style={read.fat ? { color: FATIGUE_COLOR[read.fat.level] } : undefined}
          >
            {read.fat ? t.fatLevel[read.fat.level] : '—'}
          </span>
          <span className="mss-l">{t.msFatigue}</span>
        </div>
      </div>
      <div className="mss-row">
        <span className="mss-l">{t.msLast}</span>
        <span className="mss-rv">
          {todaySets > 0
            ? t.msLastDays(0)
            : read.before.days !== null
              ? t.msLastDays(read.before.days)
              : t.msNever}
        </span>
      </div>
      <div className="mss-hint">{t.msDotsHint}</div>
    </div>
  );
}
