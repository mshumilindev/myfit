/** Exercise history — design S-32/S-33 + EQ-3 (muscles, equipment, gyms). */
import { est1rm, exerciseNeeds, missingAtGym, topSet, useStore } from '../store';
import { muscleInfoByName } from '../data/exercises';
import { fmtDayMonth, fmtKg, useT } from '../i18n';
import { Icon } from '../ui';
import { EquipChip, MuscleChip } from '../components/Muscle';
import type { Shell } from '../App';

export function ExerciseHistoryView({
  name,
  shell,
  onClose,
}: {
  name: string;
  shell: Shell;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const store = useStore();
  const needle = name.trim().toLowerCase();

  const sessions = store.workouts
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
    <div className="screen" style={{ gap: 'var(--space-6)' }}>
      <div className="hist-head">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="title-26">{name}</h2>
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
                      size="lg"
                      onClick={(muscle) => shell.openOverlay({ screen: 'muscle-history', muscle })}
                    />
                  )}
                  {info?.secondary.map((m) => (
                    <MuscleChip
                      key={m}
                      muscle={m}
                      tone="secondary"
                      size="lg"
                      onClick={(muscle) => shell.openOverlay({ screen: 'muscle-history', muscle })}
                    />
                  ))}
                  {needs.map((id) => (
                    <EquipChip key={id} id={id} style={{ padding: '4px 9px', fontSize: 11 }} />
                  ))}
                </div>
              </>
            );
          })()}
        </div>
        <button
          className="btn btn-secondary"
          style={{ minHeight: 36, fontSize: 13, flex: 'none', padding: '0 14px', gap: 6 }}
          onClick={() => shell.openOverlay({ screen: 'exercise-detail', name })}
        >
          <Icon name="cards" />
          {t.detailsAction}
        </button>
      </div>

      <div className="stat-grid">
        <div className="cell">
          <div className="v" style={{ fontSize: 20, color: 'var(--color-ok)' }}>
            {record || '—'}
          </div>
          <div className="l">{t.recordKg}</div>
        </div>
        <div className="cell">
          <div
            className="v"
            style={{ fontSize: 20, color: rm === null ? 'var(--color-neutral-700)' : undefined }}
          >
            {rm !== null ? rm : '—'}
          </div>
          <div className="l">{t.est1rm}</div>
        </div>
        <div className="cell">
          <div className="v" style={{ fontSize: 20 }}>
            {last ? (last.top.weight ?? 0) : '—'}
          </div>
          <div className="l">{t.lastTopSet}</div>
        </div>
      </div>

      {store.gyms.length > 0 && exerciseNeeds(name).length > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>
            {t.whereYouCanDoIt}
          </div>
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
                  <span className="n" style={{ fontSize: 13 }}>
                    {g.name}
                  </span>
                  {missing.length === 0 ? (
                    <span className="v">{needs.map(label).join(' · ')}</span>
                  ) : (
                    <span className="v miss">{t.noItemShort(label(missing[0]))}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="sheet-note" style={{ background: 'var(--color-surface)', marginTop: 8 }}>
            <Icon name="info" />
            <p>{t.inventoryNote}</p>
          </div>
        </div>
      )}

      {chartPts.length >= 3 ? (
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>
            {t.topSet12w}
          </div>
          <div className="chart-card">
            <svg viewBox="0 0 300 96" style={{ width: '100%', height: 96, display: 'block' }}>
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                color: 'var(--color-neutral-600)',
                marginTop: 4,
              }}
            >
              <span>{min} kg</span>
              <span style={{ color: 'var(--color-ok)' }}>{t.recordSuffix(`${record} kg`)}</span>
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
        <div className="section-label" style={{ marginBottom: 4 }}>
          {t.lastSessions}
        </div>
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
