/** Exercise history — design S-32/S-33 + EQ-3 (muscles, equipment, gyms). */
import { BackButton } from '../components/ui/BackButton';
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { est1rm, exerciseNeeds, missingAtGym, topSet, useStore } from '../store';
import { callFn } from '../api';
import type { Workout } from '../types';
import { muscleInfoByName } from '../data/exercises';
import { fmtDayMonth, fmtKg, useT } from '../i18n';
import { ExerciseName, Icon } from '../ui';
import { EquipChip, MuscleChip } from '../components/Muscle';
import type { Shell } from '../App';
import { SupplementStrengthNote } from './SupplementNotes';

export function ExerciseHistoryView({
  name,
  userId,
  userName,
  shell,
  onClose,
}: {
  name: string;
  userId?: string;
  userName?: string;
  shell: Shell;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const store = useStore();
  const needle = name.trim().toLowerCase();
  const [fetched, setFetched] = useState<{ key: string; workouts: Workout[] } | null>(null);
  const fkey = `${userId ?? ''}\u0000${name}`;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const key = `${userId}\u0000${name}`;
    callFn<{ workouts: Workout[] }>('athleteExerciseHistory', { id: userId, name })
      .then((r) => alive && setFetched({ key, workouts: r.workouts }))
      .catch(() => alive && setFetched({ key, workouts: [] }));
    return () => {
      alive = false;
    };
  }, [userId, name]);

  const source = userId
    ? fetched && fetched.key === fkey
      ? fetched.workouts
      : []
    : store.workouts;
  const sessions = source
    .filter((w) => w.finishedAt !== null)
    .map((w) => {
      const ex = w.exercises.find((e) => e.name.trim().toLowerCase() === needle);
      const top = ex && topSet(ex.sets);
      const vol = ex ? ex.sets.reduce((s, x) => s + (x.weight ?? 0) * x.reps, 0) : 0;
      return ex && top ? { ts: w.startedAt, top, vol } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const record = sessions.reduce((m, s) => Math.max(m, s.top.weight ?? 0), 0);
  const last = sessions[0];
  const rm =
    last && (last.top.weight ?? 0) > 0 ? est1rm(last.top.weight ?? 0, last.top.reps) : null;
  const since = sessions.length ? fmtDayMonth(sessions[sessions.length - 1].ts, locale) : '';

  const chartPts = [...sessions].reverse().slice(-12);
  const min = Math.min(...chartPts.map((p) => p.top.weight ?? 0), record);
  const span = Math.max(record - min, 1);

  return (
    <div className="screen ug-16">
      <div className="hist-head">
        <BackButton onClick={onClose} label={t.backAction} />
        <div className="uf-1 umw-0">
          <h2 className="title-26">
            <ExerciseName name={name} />
          </h2>
          {userName ? <div className="sub">{userName}</div> : null}
          {(() => {
            const info = muscleInfoByName(name);
            const needs = exerciseNeeds(name);
            if (!info && needs.length === 0) {
              return (
                <div className="sub">
                  {sessions.length === 1 ? t.oneSession : t.nSessionsSince(sessions.length, since)}
                </div>
              );
            }
            return (
              <>
                <div className="hist-chips">
                  {info && info.primary !== 'cardio' && (
                    <MuscleChip
                      muscle={info.primary}
                      tone="primary"
                      onClick={(muscle) => shell.openOverlay({ screen: 'muscle-history', muscle })}
                      detail
                    />
                  )}
                  {info?.secondary.map((m) => (
                    <MuscleChip
                      key={m}
                      muscle={m}
                      tone="secondary"
                      onClick={(muscle) => shell.openOverlay({ screen: 'muscle-history', muscle })}
                      detail
                    />
                  ))}
                  {needs.map((id) => (
                    <EquipChip key={id} id={id} style={{ padding: '4px 9px' }} />
                  ))}
                </div>
              </>
            );
          })()}
        </div>
        <Button
          variant="secondary"
          className="fx-fs-13 uf-none ug-6"
          style={{ minHeight: 36, padding: '0 14px' }}
          onClick={() => shell.openOverlay({ screen: 'exercise-detail', name })}
        >
          <Icon name="cards" />
          {t.detailsAction}
        </Button>
      </div>

      <div className="stat-grid">
        <div className="cell">
          <div className="v ut-2xl ut-ok">{record || '—'}</div>
          <div className="l">{t.recordKg}</div>
        </div>
        <div className="cell">
          <div
            className="v ut-2xl"
            style={{ color: rm === null ? 'var(--color-neutral-700)' : undefined }}
          >
            {rm !== null ? rm : '—'}
          </div>
          <div className="l">{t.est1rm}</div>
        </div>
        <div className="cell">
          <div className="v ut-2xl">{last ? (last.top.weight ?? 0) : '—'}</div>
          <div className="l">{t.lastTopSet}</div>
        </div>
      </div>
      {record > 0 && <SupplementStrengthNote />}

      {!userId && store.gyms.length > 0 && exerciseNeeds(name).length > 0 && (
        <div>
          <div className="section-label umb-8">{t.whereYouCanDoIt}</div>
          <div className="wcdi-rows">
            {store.gyms.map((g) => {
              const needs = exerciseNeeds(name);
              const missing = missingAtGym(g, needs);
              const names = t.equipmentNames as Record<string, string>;
              const label = (id: string) =>
                (names[id] ?? id.charAt(0).toUpperCase() + id.slice(1)).toLowerCase();
              return (
                <div key={g.id} className={`wcdi-row${missing.length > 0 ? ' miss' : ''}`}>
                  {missing.length === 0 ? (
                    <Icon name="check-circle" weight="fill" className="ok" />
                  ) : (
                    <Icon name="warning-circle" className="bad" />
                  )}
                  <span className="n ut-base">{g.name}</span>
                  {missing.length === 0 ? (
                    <span className="v">{needs.map(label).join(' · ')}</span>
                  ) : (
                    <span className="v miss">{t.noItemShort(label(missing[0]))}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="sheet-note sheet-note--surface umt-8">
            <Icon name="info" />
            <p>{t.inventoryNote}</p>
          </div>
        </div>
      )}

      {chartPts.length >= 3 ? (
        <div>
          <div className="section-label umb-8">{t.topSet12w}</div>
          <div className="chart-card">
            <svg viewBox="0 0 300 96" className="uw-full ul-block" style={{ height: 96 }}>
              <polyline
                points={chartPts
                  .map(
                    (p, i) =>
                      `${((i / (chartPts.length - 1)) * 292 + 4).toFixed(1)},${(
                        88 -
                        (((p.top.weight ?? 0) - min) / span) * 80 +
                        4
                      ).toFixed(1)}`,
                  )
                  .join(' ')}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle
                cx={296}
                cy={88 - (((chartPts[chartPts.length - 1].top.weight ?? 0) - min) / span) * 80 + 4}
                r="4"
                fill="var(--color-ok)"
              />
            </svg>
            <div className="ut-2xs ut-faint ul-flex uj-between umt-4">
              <span>{min} kg</span>
              <span className="ut-ok">{t.recordSuffix(`${record} kg`)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-card">
          <Icon name="chart-line" />
          <h4 className="t">{t.notEnoughData}</h4>
          <p className="s">{t.notEnoughDataBody}</p>
        </div>
      )}

      <div>
        <div className="section-label umb-4">{t.lastSessions}</div>
        <table className="table">
          <thead>
            <tr>
              <th>{t.dateCol}</th>
              <th>{t.topSetCol}</th>
              <th>{t.volumeCol}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.slice(0, 6).map((s, i) => (
              <tr key={i}>
                <td>{fmtDayMonth(s.ts, locale)}</td>
                <td>
                  {s.top.weight ?? 0} × {s.top.reps}
                </td>
                <td>{fmtKg(s.vol)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
