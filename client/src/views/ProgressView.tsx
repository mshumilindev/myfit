/** Progress — design S-34…S-36 + MG-3/MG-4 (by muscle, enriched detail). */
import { useEffect, useState } from 'react';
import {
  est1rm,
  exerciseNeeds,
  exerciseVolumeKg,
  missingAtGym,
  muscleVolumeKg,
  resolveMuscles,
  topSet,
  workoutVolumeKg,
  type useStore,
} from '../store';
import { fmtDayMonth, fmtKg, fmtTonnes, useT } from '../i18n';
import { EmptyState, Icon } from '../ui';
import { EquipChip, MuscleChip, MuscleIcon, MUSCLE_IDS } from '../components/Muscle';
import { muscleInfoByName, type MuscleGroup } from '../data/exercises';
import type { Shell } from '../App';

type Store = ReturnType<typeof useStore>;

const WEEK_MS = 7 * 24 * 3600 * 1000;

function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function ProgressView({ store, shell }: { store: Store; shell: Shell }) {
  const { t, locale } = useT();
  const [nowTs] = useState(() => Date.now());
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [seg, setSeg] = useState<'total' | 'muscle' | 'records'>('total');
  const [selMuscle, setSelMuscle] = useState<MuscleGroup | null>(null);
  const showDesktopDetail = useDesktopDetail();
  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  const openMuscleHistory = (muscle: MuscleGroup) =>
    shell.openOverlay({ screen: 'muscle-history', muscle });

  // Weekly volume, current week last, 10 columns.
  const thisWeek = weekStart(nowTs);
  const weeks: number[] = [];
  for (let i = 9; i >= 0; i--) {
    const start = thisWeek - i * WEEK_MS;
    weeks.push(
      finished
        .filter((w) => weekStart(w.startedAt) === start)
        .reduce((v, w) => v + workoutVolumeKg(w), 0),
    );
  }
  const maxWeek = Math.max(...weeks, 1);
  const cur = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const deltaPct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  const barColors = [
    'var(--color-neutral-800)',
    'var(--color-neutral-800)',
    'var(--color-neutral-800)',
    'var(--color-neutral-800)',
    'var(--color-neutral-800)',
    'var(--color-accent-800)',
    'var(--color-accent-700)',
    'var(--color-accent-700)',
    'var(--color-accent-600)',
    'var(--color-accent)',
  ];

  // Exercise stats: records + 1RM series for the two most frequent lifts.
  const byName = new Map<
    string,
    {
      count: number;
      recW: number;
      recReps: number;
      lastTs: number;
      recTs: number;
      primary: MuscleGroup | null;
    }
  >();
  for (const w of finished) {
    for (const e of w.exercises) {
      const key = e.name.trim();
      if (!key) continue;
      const top = topSet(e.sets);
      if (!top || (top.weight ?? 0) === 0) continue;
      const cur = byName.get(key) ?? {
        count: 0,
        recW: 0,
        recReps: 0,
        lastTs: 0,
        recTs: 0,
        primary: null as MuscleGroup | null,
      };
      cur.count++;
      cur.lastTs = Math.max(cur.lastTs, w.startedAt);
      // Group by the exercise's PRIMARY muscle only (secondary ignored).
      if (!cur.primary) cur.primary = resolveMuscles(e).primary;
      if ((top.weight ?? 0) > cur.recW) {
        cur.recW = top.weight ?? 0;
        cur.recReps = top.reps;
        cur.recTs = w.startedAt;
      }
      byName.set(key, cur);
    }
  }
  const ranked = [...byName.entries()].sort((a, b) => b[1].count - a[1].count);
  const lines = ranked.slice(0, 2).map(([name]) => {
    const pts: { ts: number; rm: number }[] = [];
    for (const w of [...finished].reverse()) {
      const e = w.exercises.find((x) => x.name.trim() === name);
      const top = e && topSet(e.sets);
      if (top && (top.weight ?? 0) > 0)
        pts.push({ ts: w.startedAt, rm: est1rm(top.weight ?? 0, top.reps) });
    }
    return { name, pts };
  });

  // Every lift with a recorded top set — the Records tab lists them all-time.
  // Ordered by how often it's trained (so the default selection has the richest
  // chart on desktop), then by the heavier record.
  const records = [...byName.entries()].sort(
    (a, b) => b[1].count - a[1].count || b[1].recW - a[1].recW,
  );
  const selected = records.find(([name]) => name === selectedName) ?? records[0] ?? null;

  // Records grouped under their PRIMARY muscle group (subheaders + icon), in
  // the canonical muscle order; anything without a known primary lands last.
  type RecordEntry = (typeof records)[number];
  const recordGroups: { muscle: MuscleGroup | null; rows: RecordEntry[] }[] = (() => {
    const byMuscle = new Map<MuscleGroup | 'other', RecordEntry[]>();
    for (const entry of records) {
      const p = entry[1].primary;
      const key: MuscleGroup | 'other' = p && p !== 'cardio' ? p : 'other';
      const list = byMuscle.get(key) ?? [];
      list.push(entry);
      byMuscle.set(key, list);
    }
    const order: (MuscleGroup | 'other')[] = [...MUSCLE_IDS, 'other'];
    return order
      .map((m) => ({
        muscle: (m === 'other' ? null : m) as MuscleGroup | null,
        rows: (byMuscle.get(m) ?? []).sort((a, b) => b[1].recW - a[1].recW),
      }))
      .filter((g) => g.rows.length > 0);
  })();
  const selectedSessions = selected
    ? finished
        .map((workout) => {
          const exercise = workout.exercises.find((item) => item.name.trim() === selected[0]);
          const top = exercise ? topSet(exercise.sets) : null;
          return exercise && top ? { workout, exercise, top } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.workout.startedAt - a.workout.startedAt)
    : [];
  const latest = selectedSessions[0] ?? null;
  const selectedRecord = selected?.[1] ?? null;
  const selectedRecordRm = selectedRecord ? est1rm(selectedRecord.recW, selectedRecord.recReps) : 0;
  const latestVolume = latest ? exerciseVolumeKg(latest.exercise) : 0;
  const selectedSince = selectedSessions.length
    ? fmtDayMonth(selectedSessions[selectedSessions.length - 1].workout.startedAt, locale)
    : '';

  function polyline(pts: { rm: number }[], w: number, h: number): string {
    if (pts.length < 2) return '';
    const min = Math.min(...pts.map((p) => p.rm));
    const max = Math.max(...pts.map((p) => p.rm));
    const span = Math.max(max - min, 1);
    return pts
      .map(
        (p, i) =>
          `${((i / (pts.length - 1)) * (w - 8) + 4).toFixed(1)},${(h - 8 - ((p.rm - min) / span) * (h - 16) + 4).toFixed(1)}`,
      )
      .join(' ');
  }

  // --- By muscle (MG-3): this week's volume per primary group --------------
  const weekWorkouts = finished.filter((w) => weekStart(w.startedAt) === thisWeek);
  const recentWorkouts = finished.filter((w) => nowTs - w.startedAt < 4 * 7 * 24 * 3600 * 1000);
  const volThisWeek = muscleVolumeKg(weekWorkouts);
  const volRecent = muscleVolumeKg(recentWorkouts);
  const muscleRows: Array<{ m: MuscleGroup; v: number }> = [...volRecent.keys()]
    .map((m) => ({ m, v: volThisWeek.get(m) ?? 0 }))
    .sort((a, b) => b.v - a.v);
  const maxMuscle = Math.max(1, ...muscleRows.map((r) => r.v));
  const weekTotal = [...volThisWeek.values()].reduce((a, b) => a + b, 0);
  const emptyMuscles = muscleRows.filter((r) => r.v === 0).map((r) => t.muscleGroups[r.m]);
  const topMuscle = muscleRows.length > 0 && muscleRows[0].v > 0 ? muscleRows[0] : null;

  function muscleBarColor(v: number): string {
    const r = v / maxMuscle;
    if (r >= 0.85) return 'var(--color-accent)';
    if (r >= 0.55) return 'var(--color-accent-600)';
    return 'var(--color-accent-700)';
  }

  function renderMuscleRows(interactive: boolean) {
    return (
      <div className="muscle-rows">
        {muscleRows.map(({ m, v }) => {
          const sel = interactive && selMuscle === m;
          const row = (
            <>
              <MuscleIcon
                muscle={m}
                variant="row"
                tone={sel ? 'onAccent' : v === 0 ? 'muted' : 'primary'}
              />
              <span className="n">{t.muscleGroups[m]}</span>
              <span className="bar">
                {v > 0 && (
                  <span
                    style={{ width: `${(v / maxMuscle) * 100}%`, background: muscleBarColor(v) }}
                  />
                )}
              </span>
              <span className="v">{v > 0 ? fmtTonnes(v) : '—'}</span>
            </>
          );
          if (!interactive) {
            return (
              <div key={m} className={`muscle-row${v === 0 ? ' dim' : ''}`}>
                {row}
              </div>
            );
          }
          return (
            <button
              key={m}
              className={`muscle-row${v === 0 ? ' dim' : ''}${sel ? ' sel' : ''}`}
              onClick={() => {
                setSelMuscle(m);
                const candidate = ranked.find(([name]) => muscleInfoByName(name)?.primary === m);
                if (candidate) setSelectedName(candidate[0]);
                if (!showDesktopDetail) openMuscleHistory(m);
              }}
            >
              {row}
            </button>
          );
        })}
      </div>
    );
  }

  const muscleNote = (
    <div className="muscle-note">
      <Icon name="scales" />
      <p>
        {t.muscleWeekNote(
          emptyMuscles.length > 0 ? emptyMuscles.join(' · ') : null,
          topMuscle ? t.muscleGroups[topMuscle.m] : null,
          topMuscle && weekTotal > 0 ? `${Math.round((topMuscle.v / weekTotal) * 100)}%` : null,
        )}
      </p>
    </div>
  );

  const segControl = (
    <div className="seg3">
      <button className={seg === 'total' ? 'active' : ''} onClick={() => setSeg('total')}>
        {t.totalLabel}
      </button>
      <button className={seg === 'muscle' ? 'active' : ''} onClick={() => setSeg('muscle')}>
        {t.byMuscle}
      </button>
      <button className={seg === 'records' ? 'active' : ''} onClick={() => setSeg('records')}>
        {t.records}
      </button>
    </div>
  );

  if (finished.length < 3) {
    return (
      <div className="screen progress-page progress-locked">
        <div className="progress-head">
          <h2 className="headline">{t.progress}</h2>
        </div>
        <div className="progress-locked-layout">
          <section className="progress-weekly-panel">
            <ProgressKpi cur={cur} deltaPct={deltaPct} label={t.volumeThisWeek} />
            <Bars weeks={weeks} maxWeek={maxWeek} colors={barColors} />
          </section>
          <div className="progress-locked-empty">
            <EmptyState
              icon="chart-line-up"
              title={t.moreSessionsTitle(Math.max(1, 3 - finished.length))}
              body={t.progressLocked(finished.length)}
            />
            <UnlockDots finishedCount={finished.length} label={t.progressUnlocksAt} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen progress-page progress-filled">
      <h2 className="visually-hidden">{t.progress}</h2>
      <section className="progress-summary-pane">
        <ProgressKpi cur={cur} deltaPct={deltaPct} label={t.volumeThisWeek} />
        {segControl}
        {seg === 'muscle' && renderMuscleRows(showDesktopDetail)}
        {seg === 'muscle' && muscleNote}
        {seg === 'total' && <Bars weeks={weeks} maxWeek={maxWeek} colors={barColors} />}

        {seg === 'total' && lines.length > 0 && lines[0].pts.length >= 2 && (
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>
              {t.estimated1rm}
            </div>
            <div className="chart-card">
              <svg viewBox="0 0 300 100" style={{ width: '100%', height: 100, display: 'block' }}>
                <polyline
                  points={polyline(lines[0].pts, 300, 100)}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {lines[1] && lines[1].pts.length >= 2 && (
                  <polyline
                    points={polyline(lines[1].pts, 300, 100)}
                    fill="none"
                    stroke="var(--color-neutral-700)"
                    strokeWidth="1.5"
                    strokeDasharray="3 4"
                  />
                )}
              </svg>
              <div className="chart-legend">
                <span>
                  <span className="sw" style={{ background: 'var(--color-accent)' }} />
                  {lines[0].name} {lines[0].pts[lines[0].pts.length - 1].rm} kg
                </span>
                {lines[1] && lines[1].pts.length >= 2 && (
                  <span>
                    <span className="sw" style={{ background: 'var(--color-neutral-700)' }} />
                    {lines[1].name} {lines[1].pts[lines[1].pts.length - 1].rm} kg
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {(seg === 'records' || (showDesktopDetail && seg !== 'muscle')) && (
          <div>
            <div
              className="section-label"
              style={{ marginBottom: 4, display: 'flex', alignItems: 'center' }}
            >
              <span style={{ flex: 1 }}>{t.records}</span>
              {showDesktopDetail && (
                <a href="#/exercises" className="link" style={{ fontSize: 12 }}>
                  {t.exercisesTitle}
                </a>
              )}
            </div>
            <div>
              {recordGroups.map((group) => (
                <div key={group.muscle ?? 'other'} className="record-group">
                  <div className="record-group-head">
                    {group.muscle ? (
                      <button
                        className="record-group-muscle"
                        onClick={() => openMuscleHistory(group.muscle as MuscleGroup)}
                      >
                        <MuscleIcon muscle={group.muscle} variant="row" tone="primary" />
                      </button>
                    ) : (
                      <Icon name="barbell" />
                    )}
                    <button
                      className="record-group-title"
                      onClick={() => group.muscle && openMuscleHistory(group.muscle)}
                    >
                      {group.muscle ? t.muscleGroups[group.muscle] : t.recordsOther}
                    </button>
                  </div>
                  {group.rows.map(([name, r]) => {
                    const wksAgo = Math.floor((nowTs - r.recTs) / WEEK_MS);
                    return (
                      <button
                        key={name}
                        className={`record-row${
                          showDesktopDetail && selected?.[0] === name ? ' selected' : ''
                        }`}
                        onClick={() => {
                          if (showDesktopDetail) setSelectedName(name);
                          else shell.openOverlay({ screen: 'exercise-history', name });
                        }}
                      >
                        <span className="n">{name}</span>
                        <span className="v">{r.recW} kg</span>
                        {wksAgo < 2 ? (
                          <span className="tag tag-ok">{t.record}</span>
                        ) : (
                          <span className="when num">{t.wksAgo(wksAgo)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {showDesktopDetail && selected && selectedRecord && (
        <section className="progress-detail-pane">
          <div>
            <div className="progress-detail-title">
              <h3>{selected[0]}</h3>
              <button
                className="link"
                onClick={() => shell.openOverlay({ screen: 'exercise-history', name: selected[0] })}
              >
                {t.fullHistory}
              </button>
            </div>
            {(() => {
              const info = muscleInfoByName(selected[0]);
              const needs = exerciseNeeds(selected[0]);
              if (!info && needs.length === 0)
                return <p>{t.nSessionsSince(selectedSessions.length, selectedSince)}</p>;
              return (
                <div className="hist-chips" style={{ alignItems: 'center' }}>
                  {info && info.primary !== 'cardio' && (
                    <MuscleChip
                      muscle={info.primary}
                      tone="primary"
                      size="lg"
                      onClick={openMuscleHistory}
                    />
                  )}
                  {info?.secondary.map((m) => (
                    <MuscleChip
                      key={m}
                      muscle={m}
                      tone="secondary"
                      size="lg"
                      onClick={openMuscleHistory}
                    />
                  ))}
                  {needs.map((id) => (
                    <EquipChip key={id} id={id} style={{ padding: '4px 9px', fontSize: 11 }} />
                  ))}
                </div>
              );
            })()}
          </div>
          <div className="progress-detail-stats">
            <div className="cell">
              <div className="v ok">{selectedRecord.recW}</div>
              <div className="l">{t.recordKg}</div>
            </div>
            <div className="cell">
              <div className="v">{selectedRecordRm}</div>
              <div className="l">{t.est1rm}</div>
            </div>
            <div className="cell">
              <div className="v">{latest?.top.weight ?? 0}</div>
              <div className="l">{t.lastTopSet}</div>
            </div>
            <div className="cell">
              <div className="v">{fmtKg(latestVolume)}</div>
              <div className="l">{t.lastVolume}</div>
            </div>
          </div>

          <div>
            <div className="section-label">{t.topSet12w}</div>
            <div className="progress-detail-chart">
              <svg viewBox="0 0 400 130" preserveAspectRatio="none">
                <polyline
                  points={polyline(
                    [...selectedSessions].reverse().map((item) => ({
                      rm: est1rm(item.top.weight ?? 0, item.top.reps),
                    })),
                    400,
                    130,
                  )}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
              <div className="progress-chart-axis">
                <span>
                  {selectedSessions.length
                    ? `${selectedSessions.length} ${t.gymStatSessions.toLowerCase()}`
                    : ''}
                </span>
                <span>
                  {selectedRecord.recW} kg · {t.record}
                </span>
              </div>
            </div>
          </div>

          {store.gyms.length > 0 && (
            <div>
              <div className="section-label">{t.whereYouCanDoIt}</div>
              <table className="table progress-detail-table">
                <thead>
                  <tr>
                    <th>{t.gymCol}</th>
                    <th>{t.needsCol}</th>
                    <th>{t.statusCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {store.gyms.map((g) => {
                    const needs = exerciseNeeds(selected[0]);
                    const missing = missingAtGym(g, needs);
                    return (
                      <tr key={g.id}>
                        <td>{g.name}</td>
                        <td style={{ color: 'var(--color-neutral-400)' }}>
                          {needs.map((id) => equipLabel(id, t)).join(' · ') || '—'}
                        </td>
                        <td>
                          {missing.length === 0 ? (
                            <span style={{ color: 'var(--color-ok-text)' }}>
                              {t.allHere(needs.length)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-danger-text)' }}>
                              {t.noItemShort(equipLabel(missing[0], t))}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ProgressKpi({
  cur,
  deltaPct,
  label,
}: {
  cur: number;
  deltaPct: number | null;
  label: string;
}) {
  return (
    <div className="kpi">
      <div>
        <div className="big num">
          {(cur / 1000).toFixed(1)}
          <span className="unit"> t</span>
        </div>
        <div className="lab">{label}</div>
      </div>
      {deltaPct !== null && (
        <span
          className={`tag ${deltaPct >= 0 ? 'tag-accent' : 'tag-neutral'}`}
          style={{ marginBottom: 22 }}
        >
          {deltaPct >= 0 ? '+' : '−'}
          {Math.abs(deltaPct)}%
        </span>
      )}
    </div>
  );
}

function Bars({ weeks, maxWeek, colors }: { weeks: number[]; maxWeek: number; colors: string[] }) {
  return (
    <div className="bars">
      {weeks.map((v, i) => (
        <div
          key={i}
          className="bar"
          style={{
            height: `${Math.max((v / maxWeek) * 100, 4)}%`,
            background: colors[i],
          }}
        />
      ))}
    </div>
  );
}

function UnlockDots({ finishedCount, label }: { finishedCount: number; label: string }) {
  return (
    <div className="unlock">
      <span style={{ flex: 1 }}>{label}</span>
      <span className="dots">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < finishedCount ? 'on' : ''} />
        ))}
      </span>
    </div>
  );
}

function equipLabel(id: string, t: ReturnType<typeof useT>['t']): string {
  const names = t.equipmentNames as Record<string, string>;
  return names[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

function getDesktopDetailMatch(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(min-width: 960px)').matches
  );
}

function useDesktopDetail(): boolean {
  const [matches, setMatches] = useState(getDesktopDetailMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(min-width: 960px)');
    const onChange = () => setMatches(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return matches;
}
