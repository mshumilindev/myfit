/** Muscle history — direct drilldown from muscle chips across the app. */
import { useState } from 'react';
import { exerciseVolumeKg, resolveMuscles, topSet, useStore } from '../store';
import { fmtDayMonth, fmtKg, fmtTonnes, useT } from '../i18n';
import { MuscleIcon } from '../components/Muscle';
import { type MuscleGroup } from '../data/exercises';
import { Icon } from '../ui';
import type { Shell } from '../App';

const WEEK_MS = 7 * 24 * 3600 * 1000;

function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function MuscleHistoryView({
  muscle,
  shell,
  onClose,
}: {
  muscle: MuscleGroup;
  shell: Shell;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const store = useStore();
  const [nowTs] = useState(() => Date.now());
  const finished = store.workouts
    .filter((w) => w.finishedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt);

  const sessions = finished
    .map((w) => {
      const exercises = w.exercises
        .map((ex) => {
          const muscles = resolveMuscles(ex);
          const involved = muscles.primary === muscle || muscles.secondary.includes(muscle);
          if (!involved) return null;
          return {
            id: ex.id,
            name: ex.name,
            sets: ex.sets.length,
            volume: exerciseVolumeKg(ex),
            top: topSet(ex.sets),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (exercises.length === 0) return null;
      return {
        workout: w,
        exercises,
        sets: exercises.reduce((sum, ex) => sum + ex.sets, 0),
        volume: exercises.reduce((sum, ex) => sum + ex.volume, 0),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const totalVolume = sessions.reduce((sum, s) => sum + s.volume, 0);
  const totalSets = sessions.reduce((sum, s) => sum + s.sets, 0);
  const last = sessions[0] ?? null;
  const weeks = Array.from({ length: 10 }, (_, i) => {
    const start = weekStart(nowTs) - (9 - i) * WEEK_MS;
    return sessions
      .filter((s) => weekStart(s.workout.startedAt) === start)
      .reduce((sum, s) => sum + s.volume, 0);
  });
  const maxWeek = Math.max(...weeks, 1);

  const byExercise = new Map<string, { sets: number; volume: number; sessions: number }>();
  for (const s of sessions) {
    const seen = new Set<string>();
    for (const ex of s.exercises) {
      const row = byExercise.get(ex.name) ?? { sets: 0, volume: 0, sessions: 0 };
      row.sets += ex.sets;
      row.volume += ex.volume;
      if (!seen.has(ex.name)) {
        row.sessions += 1;
        seen.add(ex.name);
      }
      byExercise.set(ex.name, row);
    }
  }
  const topExercises = [...byExercise.entries()]
    .sort((a, b) => b[1].volume - a[1].volume || b[1].sets - a[1].sets)
    .slice(0, 6);

  return (
    <div className="screen muscle-history-screen">
      <div className="hist-head">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <div className="mh-title">
          <MuscleIcon muscle={muscle} variant="row" tone="primary" />
          <div>
            <h2 className="title-26">{t.muscleHistoryTitle(t.muscleGroups[muscle])}</h2>
            <div className="sub">
              {sessions.length === 1
                ? t.oneSession
                : t.nSessionsSince(
                    sessions.length,
                    sessions.length
                      ? fmtDayMonth(sessions[sessions.length - 1].workout.startedAt, locale)
                      : '',
                  )}
            </div>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="cell">
          <div className="v">{fmtTonnes(totalVolume)}</div>
          <div className="l">{t.volumeCol}</div>
        </div>
        <div className="cell">
          <div className="v">{totalSets || '—'}</div>
          <div className="l">{t.setsStat}</div>
        </div>
        <div className="cell">
          <div className="v">{last ? fmtDayMonth(last.workout.startedAt, locale) : '—'}</div>
          <div className="l">{t.lastSessionLabel}</div>
        </div>
      </div>

      <div>
        <div className="section-label">{t.weeklyVolume}</div>
        <div className="bars mh-bars">
          {weeks.map((v, i) => (
            <div
              key={i}
              className="bar"
              style={{
                height: `${Math.max((v / maxWeek) * 100, 4)}%`,
                background: i >= 5 ? 'var(--color-accent)' : 'var(--color-accent-700)',
              }}
            />
          ))}
        </div>
      </div>

      {topExercises.length > 0 && (
        <div>
          <div className="section-label">{t.topExercises}</div>
          <div className="record-group">
            {topExercises.map(([name, row]) => (
              <button
                key={name}
                className="record-row"
                onClick={() => shell.openOverlay({ screen: 'exercise-history', name })}
              >
                <span className="n">{name}</span>
                <span className="v">{fmtKg(row.volume)}</span>
                <span className="when num">{row.sets}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="section-label">{t.lastSessions}</div>
        <div className="mh-session-list">
          {sessions.slice(0, 8).map((s) => (
            <button
              key={s.workout.id}
              className="recent-row"
              onClick={() => shell.openOverlay({ screen: 'past-workout', workoutId: s.workout.id })}
            >
              <span className="d">{fmtDayMonth(s.workout.startedAt, locale)}</span>
              <span style={{ flex: 1 }}>
                <span className="name">{s.exercises.map((ex) => ex.name).join(' · ')}</span>
                <div className="stats">
                  {s.sets} {t.sets} · {fmtKg(s.volume)}
                </div>
              </span>
              <Icon name="arrow-up-right" className="go" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
