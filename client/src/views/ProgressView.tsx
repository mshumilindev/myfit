/** Progress — design S-34…S-36 + MG-3/MG-4 (by muscle, enriched detail). */
import { useEffect, useState } from 'react';
import {
  estimatedOneRepMaxSet,
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
import { EmptyState, Icon, Sheet } from '../ui';
import { EquipChip, MuscleChip, MuscleHeatmap, MuscleIcon, MUSCLE_IDS } from '../components/Muscle';
import { muscleInfoByName, type MuscleGroup } from '../data/exercises';
import type { Shell } from '../App';
import type { Workout } from '../types';
import {
  classifyZone,
  historyAgeDays,
  LANDMARKS,
  VOLUME_MUSCLES,
  VOLUME_ZONES,
  scaleLandmark,
  weeklyMuscleSets,
  volumeHeatColors,
  zoneSets,
  ZONE_COLOR,
  type Landmark,
  type Zone,
} from '../volume';
import { TrendsView } from '../components/TrendsView';
import { FixSheet } from '../components/FixSheet';
import { ReadinessLens } from '../components/Readiness';
import {
  muscleFatigue,
  deloadSuggestion,
  FATIGUE_COLOR,
  type FatigueLevel,
  type DeloadSuggestion,
} from '../fatigue';
import { activityRecoveryBias } from '../activities';
import {
  personalLandmarks,
  tuneSummary,
  type PersonalLandmark,
  type TuneSummary,
} from '../personalize';
import { volumeWeakPoints, type WeakPoint } from '../weakpoints';

type Store = ReturnType<typeof useStore>;

const WEEK_MS = 7 * 24 * 3600 * 1000;

function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function ProgressView({
  store,
  shell,
  sub,
  onSub,
  seg,
  onSeg,
  lens,
  onLens,
}: {
  store: Store;
  shell: Shell;
  sub: 'progress' | 'trends';
  onSub: (s: 'progress' | 'trends') => void;
  seg: 'total' | 'muscle' | 'volume' | 'records';
  onSeg: (s: 'total' | 'muscle' | 'volume' | 'records') => void;
  lens: 'volume' | 'fatigue' | 'readiness';
  onLens: (l: 'volume' | 'fatigue' | 'readiness') => void;
}) {
  const { t, locale } = useT();
  const [nowTs] = useState(() => Date.now());
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const setSeg = onSeg;
  const [selMuscle, setSelMuscle] = useState<MuscleGroup | null>(null);
  const [volGrain, setVolGrain] = useState<'fine' | 'zones'>('fine');
  const setLens = onLens;
  // Volume read window (days): a rolling week by default, widenable in the sheet.
  const [rangeDays, setRangeDays] = useState(7);
  // Mobile: list<->map choice + the "all controls" sheet, driven by the pill.
  const [mapView, setMapView] = useState(false);
  const [ctrlSheet, setCtrlSheet] = useState(false);
  const ptab = sub;
  const setPtab = onSub;
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
      recE1rm: number;
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
        recE1rm: 0,
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
      const e1rmTop = estimatedOneRepMaxSet(e.sets);
      if (e1rmTop) cur.recE1rm = Math.max(cur.recE1rm, est1rm(e1rmTop.weight ?? 0, e1rmTop.reps));
      byName.set(key, cur);
    }
  }
  const ranked = [...byName.entries()].sort((a, b) => b[1].count - a[1].count);
  const lines = ranked.slice(0, 2).map(([name]) => {
    const pts: { ts: number; rm: number }[] = [];
    for (const w of [...finished].reverse()) {
      const e = w.exercises.find((x) => x.name.trim() === name);
      const top = e && estimatedOneRepMaxSet(e.sets);
      if (top) {
        pts.push({ ts: w.startedAt, rm: est1rm(top.weight ?? 0, top.reps) });
      }
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
          const top = exercise
            ? (estimatedOneRepMaxSet(exercise.sets) ?? topSet(exercise.sets))
            : null;
          return exercise && top ? { workout, exercise, top } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.workout.startedAt - a.workout.startedAt)
    : [];
  const latest = selectedSessions[0] ?? null;
  const selectedRecord = selected?.[1] ?? null;
  const selectedRecordRm = selectedRecord?.recE1rm ?? 0;
  const selectedE1rmPoints = selectedSessions
    .map((item) => {
      const top = estimatedOneRepMaxSet(item.exercise.sets);
      return top ? { rm: est1rm(top.weight ?? 0, top.reps) } : null;
    })
    .filter((item): item is { rm: number } => item !== null)
    .reverse();
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
  // Brass heatmap: each muscle shaded by how much of this week's tonnage it got
  // (faint -> full brass). Powers the desktop Total / By-muscle right column.
  const brassColors: Partial<Record<MuscleGroup, string>> = {};
  for (const { m, v } of muscleRows) if (v > 0) brassColors[m] = brassShade(v / maxMuscle);
  // Volume landmarks tuned to this athlete's own history (falls back to the
  // generic ranges until there's enough data) — used everywhere the zones read.
  const pLandmarks = personalLandmarks(finished, nowTs);
  const tuned = tuneSummary(pLandmarks);
  // Zone-coloured volume heatmap for the desktop Volume right column.
  const volHeat = volumeHeatColors(finished, nowTs, volGrain, rangeDays, pLandmarks);
  // Fatigue lens: trained muscles tinted fresh -> fried; plus a deload nudge.
  const fatMap = muscleFatigue(finished, nowTs, pLandmarks);
  const fatColors: Partial<Record<MuscleGroup, string>> = {};
  for (const f of fatMap.values()) if (f.sets > 0) fatColors[f.muscle] = FATIGUE_COLOR[f.level];
  const deload = deloadSuggestion(fatMap, activityRecoveryBias(store.activities, nowTs));
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
    <div className="seg3 seg4">
      <button className={seg === 'total' ? 'active' : ''} onClick={() => setSeg('total')}>
        {t.totalLabel}
      </button>
      <button className={seg === 'muscle' ? 'active' : ''} onClick={() => setSeg('muscle')}>
        {t.byMuscle}
      </button>
      <button className={seg === 'volume' ? 'active' : ''} onClick={() => setSeg('volume')}>
        {t.volumeTab}
      </button>
      <button className={seg === 'records' ? 'active' : ''} onClick={() => setSeg('records')}>
        {t.records}
      </button>
    </div>
  );

  const pTabs = (
    <div className="prog-tabs progress-subtabs" role="tablist">
      <button
        role="tab"
        aria-selected={ptab === 'progress'}
        className={ptab === 'progress' ? 'active' : ''}
        onClick={() => setPtab('progress')}
      >
        {t.progress}
      </button>
      <button
        role="tab"
        aria-selected={ptab === 'trends'}
        className={ptab === 'trends' ? 'active' : ''}
        onClick={() => setPtab('trends')}
      >
        {t.trendsTab}
      </button>
    </div>
  );

  if (ptab === 'trends') {
    return (
      <div className="screen progress-page progress-alt">
        <div className="progress-tabbar">{pTabs}</div>
        <div className="progress-alt-body">
          <TrendsView finished={finished} body={store.bodyMetrics} />
        </div>
      </div>
    );
  }

  if (finished.length < 3) {
    return (
      <div className="screen progress-page progress-locked">
        <div className="progress-tabbar">{pTabs}</div>
        <div className="progress-locked-body">
          {weeks.some((v) => v > 0) ? (
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
          ) : (
            // Empty account: the weekly chart has no data, so a bare min-height bar
            // row just reads as broken — show a clean standalone empty card instead.
            <div className="progress-locked-empty solo">
              <EmptyState
                icon="chart-line-up"
                title={t.moreSessionsTitle(Math.max(1, 3 - finished.length))}
                body={t.progressLocked(finished.length)}
              />
              <UnlockDots finishedCount={finished.length} label={t.progressUnlocksAt} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen progress-page progress-filled">
      <h2 className="visually-hidden">{t.progress}</h2>
      {/* Liquid-glass refraction filter for the mobile control pill. */}
      <svg className="glass-defs" aria-hidden width="0" height="0">
        <filter
          id="liquid-glass"
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.011 0.011"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="1.4" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale="52"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
      <div className="progress-tabbar">{pTabs}</div>
      <section className="progress-summary-pane">
        <ProgressKpi cur={cur} deltaPct={deltaPct} label={t.volumeThisWeek} />
        {segControl}
        {seg === 'muscle' && renderMuscleRows(showDesktopDetail)}
        {seg === 'muscle' && muscleNote}
        {seg === 'volume' && (
          <VolumePanel
            finished={finished}
            nowTs={nowTs}
            t={t}
            grain={volGrain}
            onGrain={setVolGrain}
            rangeDays={rangeDays}
            landmarks={pLandmarks}
            tuned={tuned}
            desktop={showDesktopDetail}
            deload={deload}
            lens={lens}
            onLens={setLens}
            fatColors={fatColors}
            mapView={mapView}
            onMapView={setMapView}
          />
        )}
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

        {seg === 'records' && (
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

      {showDesktopDetail && seg === 'volume' && (
        <section className="progress-detail-pane vol-map-pane">
          <div className="progress-detail-title">
            <h3>
              {lens === 'fatigue'
                ? t.fatigueTab
                : lens === 'readiness'
                  ? t.readinessKicker
                  : t.volumeTab}
            </h3>
            <div className="seg2 seg3 lens-seg">
              <button
                className={lens === 'volume' ? 'active' : ''}
                onClick={() => setLens('volume')}
              >
                {t.volumeTab}
              </button>
              <button
                className={lens === 'fatigue' ? 'active' : ''}
                onClick={() => setLens('fatigue')}
              >
                {t.fatigueTab}
              </button>
              <button
                className={lens === 'readiness' ? 'active' : ''}
                onClick={() => setLens('readiness')}
              >
                {t.readinessKicker}
              </button>
            </div>
          </div>
          {lens === 'readiness' ? (
            <ReadinessLens finished={finished} now={nowTs} view="map" />
          ) : (
            <>
              <MuscleHeatmap colors={lens === 'fatigue' ? fatColors : volHeat} />
              {lens === 'fatigue' ? (
                <div className="vol-legend">
                  {(['fresh', 'moderate', 'high', 'fried'] as FatigueLevel[]).map((l) => (
                    <span key={l} className="vol-leg">
                      <span className="sw" style={{ background: FATIGUE_COLOR[l] }} />
                      {t.fatLevel[l]}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="vol-legend">
                  {(['under', 'productive', 'high', 'over'] as Zone[]).map((z) => (
                    <span key={z} className="vol-leg">
                      <span className="sw" style={{ background: ZONE_COLOR[z] }} />
                      {t.volZone[z]}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {showDesktopDetail && (seg === 'muscle' || seg === 'total') && (
        <section className="progress-detail-pane vol-map-pane">
          <div className="progress-detail-title">
            <h3>{t.volumeThisWeek}</h3>
          </div>
          <MuscleHeatmap colors={brassColors} />
          <div className="brass-legend">
            <span className="brass-grad" aria-hidden />
          </div>
        </section>
      )}

      {seg === 'records' && showDesktopDetail && selected && selectedRecord && (
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
              <div className="v">{selectedRecordRm > 0 ? selectedRecordRm : '—'}</div>
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
                  points={polyline(selectedE1rmPoints, 400, 130)}
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

      {/* Mobile: all Progress controls live on a floating graphite-glass pill
          (design "Progress Nav Explorations" V4); the gear opens a sheet with
          every control. Hidden on desktop, where the inline toggles stay. */}
      <div className="progress-pill-wrap">
        <div className="progress-pill">
          <Icon name="chart-line-up" weight="fill" />
          <span className="pp-label">
            {seg === 'volume'
              ? lens === 'fatigue'
                ? t.fatigueTab
                : lens === 'readiness'
                  ? t.readinessKicker
                  : t.volumeTab
              : segLabel(seg, t)}
          </span>
          {seg === 'volume' && (
            <>
              <span className="pp-sep" aria-hidden />
              <span className="pp-seg">
                <button className={!mapView ? 'on' : ''} onClick={() => setMapView(false)}>
                  {t.volList}
                </button>
                <button className={mapView ? 'on' : ''} onClick={() => setMapView(true)}>
                  {t.volMap}
                </button>
              </span>
            </>
          )}
          <button
            className="pp-gear"
            onClick={() => setCtrlSheet(true)}
            aria-label={t.progControls}
          >
            <Icon name="funnel-simple" />
          </button>
        </div>
      </div>

      {ctrlSheet && (
        <Sheet onClose={() => setCtrlSheet(false)} className="prog-ctrl-sheet">
          <div className="pcs-title">{t.progControls}</div>
          <div className="pcs-group">
            <div className="pcs-lbl">{t.progSection}</div>
            <div className="seg pcs-seg">
              {(['total', 'muscle', 'volume', 'records'] as const).map((s) => (
                <button key={s} className={seg === s ? 'on' : ''} onClick={() => setSeg(s)}>
                  {segLabel(s, t)}
                </button>
              ))}
            </div>
          </div>
          {seg === 'volume' && (
            <>
              <div className="pcs-group">
                <div className="pcs-lbl">{t.progLens}</div>
                <div className="seg pcs-seg">
                  <button
                    className={lens === 'volume' ? 'on' : ''}
                    onClick={() => setLens('volume')}
                  >
                    {t.volumeTab}
                  </button>
                  <button
                    className={lens === 'fatigue' ? 'on' : ''}
                    onClick={() => setLens('fatigue')}
                  >
                    {t.fatigueTab}
                  </button>
                  <button
                    className={lens === 'readiness' ? 'on' : ''}
                    onClick={() => setLens('readiness')}
                  >
                    {t.readinessKicker}
                  </button>
                </div>
              </div>
              <div className="pcs-row2">
                <div className="pcs-group">
                  <div className="pcs-lbl">{t.progShowAs}</div>
                  <div className="seg pcs-seg">
                    <button className={!mapView ? 'on' : ''} onClick={() => setMapView(false)}>
                      {t.volList}
                    </button>
                    <button className={mapView ? 'on' : ''} onClick={() => setMapView(true)}>
                      {t.volMap}
                    </button>
                  </div>
                </div>
                <div className="pcs-group">
                  <div className="pcs-lbl">{t.progDetail}</div>
                  <div className="seg pcs-seg">
                    <button
                      className={volGrain === 'fine' ? 'on' : ''}
                      onClick={() => setVolGrain('fine')}
                    >
                      {t.volFine}
                    </button>
                    <button
                      className={volGrain === 'zones' ? 'on' : ''}
                      onClick={() => setVolGrain('zones')}
                    >
                      {t.volZones}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
          <label className="pcs-range">
            <Icon name="calendar-blank" />
            <span>{t.progRange}</span>
            <span className="pcs-range-sel">
              <select
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                aria-label={t.progRange}
              >
                <option value={7}>{t.volRange7}</option>
                <option value={14}>{t.volRange14}</option>
                <option value={28}>{t.volRange28}</option>
              </select>
              <Icon name="caret-down" />
            </span>
          </label>
        </Sheet>
      )}
    </div>
  );
}

/** Localised label for a Progress section. */
function segLabel(s: 'total' | 'muscle' | 'volume' | 'records', t: T): string {
  return s === 'total'
    ? t.totalLabel
    : s === 'muscle'
      ? t.byMuscle
      : s === 'volume'
        ? t.volumeTab
        : t.records;
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

type T = ReturnType<typeof useT>['t'];

/** Fractional sets to one decimal, trailing ".0" trimmed. */
function fmtSets(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Brass shade for a 0..1 intensity: faint graphite-brass -> full brass. */
function brassShade(frac: number): string {
  const pct = Math.round(26 + 64 * Math.min(1, Math.max(0, frac)));
  return `color-mix(in srgb, var(--color-accent) ${pct}%, var(--color-neutral-800))`;
}

interface VolRow {
  key: string;
  label: string;
  muscle?: MuscleGroup;
  sets: number;
  lm: Landmark;
  zone: Zone;
}

/**
 * Volume landmarks (design VOL-1..3): each muscle's trailing-week working sets
 * against its MEV/MAV/MRV range, as a zoned bar list or an anatomical heatmap,
 * at fine (17-group) or coarse (6-zone) grain.
 */
function VolumePanel({
  finished,
  nowTs,
  t,
  grain,
  onGrain,
  rangeDays,
  landmarks,
  tuned,
  desktop,
  deload,
  lens,
  onLens,
  fatColors,
  mapView,
  onMapView,
}: {
  finished: Workout[];
  nowTs: number;
  t: T;
  grain: 'fine' | 'zones';
  onGrain: (g: 'fine' | 'zones') => void;
  rangeDays: number;
  landmarks: ReadonlyMap<MuscleGroup, PersonalLandmark>;
  tuned: TuneSummary;
  desktop: boolean;
  deload: DeloadSuggestion;
  lens: 'volume' | 'fatigue' | 'readiness';
  onLens: (l: 'volume' | 'fatigue' | 'readiness') => void;
  fatColors: Partial<Record<MuscleGroup, string>>;
  mapView: boolean;
  onMapView: (m: boolean) => void;
}) {
  // On desktop the anatomical map lives in the right column; on mobile the list
  // <-> map choice comes from the floating control pill (mapView prop).
  const setMapView = onMapView;
  const [fixMuscle, setFixMuscle] = useState<MuscleGroup | null>(null);
  // Default: most-loaded first (Over -> ... -> None), toggleable.
  const [sortDesc, setSortDesc] = useState(true);

  const perMuscle = weeklyMuscleSets(finished, nowTs, rangeDays);
  const weeks = rangeDays / 7;
  const cold = historyAgeDays(finished, nowTs) < 21;
  // Chronic weak points: muscles under MEV across most of the last 6 weeks.
  const weakPoints = volumeWeakPoints(finished, nowTs, 6, landmarks);

  // Personalised landmark per muscle / zone (falls back to the generic default).
  const lmFor = (m: MuscleGroup): Landmark => landmarks.get(m) ?? (LANDMARKS[m] as Landmark);
  const zoneLm = (members: MuscleGroup[]): Landmark => {
    const out: Landmark = { mev: 0, mav: 0, mrv: 0 };
    for (const m of members) {
      const lm = landmarks.get(m) ?? LANDMARKS[m];
      if (!lm) continue;
      out.mev += lm.mev;
      out.mav += lm.mav;
      out.mrv += lm.mrv;
    }
    return out;
  };

  const rows: VolRow[] =
    grain === 'fine'
      ? VOLUME_MUSCLES.map((m) => {
          const lm = scaleLandmark(lmFor(m), weeks);
          const sets = perMuscle.get(m) ?? 0;
          return {
            key: m,
            label: t.muscleGroups[m],
            muscle: m,
            sets,
            lm,
            zone: classifyZone(sets, lm),
          };
        })
      : VOLUME_ZONES.map((z) => {
          const lm = scaleLandmark(zoneLm(z.members), weeks);
          const sets = zoneSets(perMuscle, z.members);
          const names = t.volZoneNames as Record<string, string>;
          return {
            key: z.key,
            label: names[z.key] ?? z.label,
            sets,
            lm,
            zone: classifyZone(sets, lm),
          };
        });

  // Sort by how hard the muscle is pushed against its ceiling (sets / MRV), so
  // Over sits at the top by default; the button flips the direction.
  const sortedRows = [...rows].sort((a, b) => {
    const d = a.sets / a.lm.mrv - b.sets / b.lm.mrv;
    return sortDesc ? -d : d;
  });

  // Heatmap: paint every muscle by its (fine or zone) classification colour.
  const heatColors: Partial<Record<MuscleGroup, string>> = {};
  if (grain === 'fine') {
    for (const m of VOLUME_MUSCLES) {
      const sets = perMuscle.get(m) ?? 0;
      if (sets > 0) heatColors[m] = ZONE_COLOR[classifyZone(sets, scaleLandmark(lmFor(m), weeks))];
    }
  } else {
    for (const z of VOLUME_ZONES) {
      const sets = zoneSets(perMuscle, z.members);
      if (sets <= 0) continue;
      const col = ZONE_COLOR[classifyZone(sets, scaleLandmark(zoneLm(z.members), weeks))];
      for (const m of z.members) heatColors[m] = col;
    }
  }

  const belowCount = rows.filter((r) => r.zone === 'under' || r.zone === 'none').length;
  const overCount = rows.filter((r) => r.zone === 'over').length;
  const summary =
    overCount > 0 ? t.volAbove(overCount) : belowCount > 0 ? t.volBelow(belowCount) : t.volAllGood;

  return (
    <div className="vol-panel">
      <div className="vol-controls">
        <div className="seg2">
          <button className={grain === 'fine' ? 'active' : ''} onClick={() => onGrain('fine')}>
            {t.volFine}
          </button>
          <button className={grain === 'zones' ? 'active' : ''} onClick={() => onGrain('zones')}>
            {t.volZones}
          </button>
        </div>
        {!desktop && (
          <div className="seg2">
            <button className={!mapView ? 'active' : ''} onClick={() => setMapView(false)}>
              {t.volList}
            </button>
            <button className={mapView ? 'active' : ''} onClick={() => setMapView(true)}>
              {t.volMap}
            </button>
          </div>
        )}
        {!(mapView && !desktop) && (
          <button
            className={`vol-sort${sortDesc ? '' : ' asc'}`}
            onClick={() => setSortDesc((s) => !s)}
            aria-label={t.volSort}
            title={t.volSort}
          >
            <Icon name="caret-line-down" />
          </button>
        )}
      </div>

      {cold && <div className="vol-cold">{t.volColdStart}</div>}

      {lens === 'readiness' ? (
        <ReadinessLens
          finished={finished}
          now={nowTs}
          view={!desktop && mapView ? 'map' : 'list'}
        />
      ) : mapView && !desktop ? (
        <div className="vol-map">
          <div className="seg2 seg3 lens-seg-m">
            <button className={lens === 'volume' ? 'active' : ''} onClick={() => onLens('volume')}>
              {t.volumeTab}
            </button>
            <button
              className={lens === 'fatigue' ? 'active' : ''}
              onClick={() => onLens('fatigue')}
            >
              {t.fatigueTab}
            </button>
            <button className="" onClick={() => onLens('readiness')}>
              {t.readinessKicker}
            </button>
          </div>
          <MuscleHeatmap colors={lens === 'fatigue' ? fatColors : heatColors} />
          {lens === 'fatigue' ? (
            <div className="vol-legend">
              {(['fresh', 'moderate', 'high', 'fried'] as FatigueLevel[]).map((l) => (
                <span key={l} className="vol-leg">
                  <span className="sw" style={{ background: FATIGUE_COLOR[l] }} />
                  {t.fatLevel[l]}
                </span>
              ))}
            </div>
          ) : (
            <div className="vol-legend">
              {(['under', 'productive', 'high', 'over'] as Zone[]).map((z) => (
                <span key={z} className="vol-leg">
                  <span className="sw" style={{ background: ZONE_COLOR[z] }} />
                  {t.volZone[z]}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="vol-rows">
          {sortedRows.map((r) => (
            <VolumeRow key={r.key} row={r} t={t} onFix={setFixMuscle} />
          ))}
        </div>
      )}

      {/* Coaching cards kept together in one block instead of scattered: the
          volume summary + personalisation note (only on the volume lens, where
          they mean something) then the deload and weak-point nudges. */}
      {(lens === 'volume' || deload.kind !== 'none' || weakPoints.length > 0) && (
        <div className="coach-group">
          {lens === 'volume' && (
            <>
              <div className="vol-note">
                <Icon name="scales" />
                <p>{summary}</p>
              </div>
              <div className={`vol-tuned${tuned.tunedCount > 0 ? ' on' : ''}`}>
                <Icon name={tuned.tunedCount > 0 ? 'user-focus' : 'info'} />
                <span>
                  {tuned.tunedCount > 0 ? t.volTuned(tuned.tunedCount) : t.volTunedDefault}
                </span>
              </div>
            </>
          )}
          {deload.kind !== 'none' && <DeloadCard deload={deload} t={t} />}
          {weakPoints.length > 0 && <WeakPointsCard weak={weakPoints} t={t} onFix={setFixMuscle} />}
        </div>
      )}

      {fixMuscle && <FixSheet muscle={fixMuscle} onClose={() => setFixMuscle(null)} />}
    </div>
  );
}

/** Deload nudge (design FAT-2): a single fried muscle earns a local cut; a lot
 *  of accumulated fatigue earns a lighter recovery week. */
function DeloadCard({ deload, t }: { deload: DeloadSuggestion; t: T }) {
  const systemic = deload.kind === 'systemic';
  const muscle = deload.muscle ? t.muscleGroups[deload.muscle] : '';
  return (
    <div className={`deload-card ${deload.kind}`}>
      <Icon name="warning-circle" weight="fill" />
      <div className="dl-main">
        <div className="dl-title">
          {systemic ? t.deloadSystemicTitle : t.deloadLocalTitle(muscle)}
        </div>
        <div className="dl-body">{systemic ? t.deloadSystemicBody : t.deloadLocalBody(muscle)}</div>
      </div>
    </div>
  );
}

/** Weak-point radar (feature #2): muscles chronically under MEV over the last
 *  several weeks — a trend, not this week's snapshot. Each offers a one-tap fix. */
function WeakPointsCard({
  weak,
  t,
  onFix,
}: {
  weak: WeakPoint[];
  t: T;
  onFix: (m: MuscleGroup) => void;
}) {
  return (
    <div className="weak-card">
      <div className="weak-head">
        <Icon name="user-focus" weight="fill" />
        <div className="weak-titles">
          <div className="weak-title">{t.weakTitle}</div>
          <div className="weak-sub">{t.weakSub}</div>
        </div>
      </div>
      <div className="weak-rows">
        {weak.map((w) => (
          <div key={w.muscle} className="weak-row">
            <MuscleIcon muscle={w.muscle} variant="row" tone="muted" />
            <span className="weak-name">{t.muscleGroups[w.muscle]}</span>
            <span className="weak-dot" style={{ opacity: 0.35 + w.severity * 0.65 }} />
            <span className="weak-metric">{t.weakUnder(w.weeksUnder, w.weeksTracked)}</span>
            <span className="weak-sets">{t.weakAvg(w.avgSets, w.mev)}</span>
            <button className="vol-fix" onClick={() => onFix(w.muscle)}>
              <Icon name="plus" weight="bold" />
              {t.fixCta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function VolumeRow({ row, t, onFix }: { row: VolRow; t: T; onFix: (m: MuscleGroup) => void }) {
  const { lm, sets, zone } = row;
  const scaleMax = Math.max(lm.mrv * 1.3, sets * 1.05, lm.mrv + 2);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / scaleMax) * 100))}%`;
  // A lagging muscle earns a one-tap fix (design FIX-1).
  const canFix = !!row.muscle && (zone === 'under' || zone === 'none');
  return (
    <div className={`vol-row z-${zone}`}>
      <div className="vol-row-head">
        {row.muscle && (
          <MuscleIcon muscle={row.muscle} variant="row" tone={sets > 0 ? 'primary' : 'muted'} />
        )}
        <span className="vol-name">{row.label}</span>
        {canFix && (
          <button className="vol-fix" onClick={() => onFix(row.muscle as MuscleGroup)}>
            <Icon name="plus" weight="bold" />
            {t.fixCta}
          </button>
        )}
        <span className="vol-sets">
          {fmtSets(sets)}
          <em>{t.volSetsUnit}</em>
        </span>
        <span className={`vol-tag z-${zone}`}>{t.volZone[zone]}</span>
      </div>
      <div className="vol-bar">
        <span className="vz vz-under" style={{ width: pct(lm.mev) }} />
        <span className="vz vz-prod" style={{ width: pct(lm.mav - lm.mev) }} />
        <span className="vz vz-high" style={{ width: pct(lm.mrv - lm.mav) }} />
        <span className="vz vz-over" style={{ width: pct(scaleMax - lm.mrv) }} />
        <span className="vol-marker" style={{ left: pct(Math.min(sets, scaleMax)) }} />
      </div>
      <div className="vol-cap">
        <span className="vol-cap-prod">
          {t.volProductive} {lm.mev}&ndash;{lm.mav}
        </span>
        <span className="vol-cap-mrv">MRV {lm.mrv}</span>
      </div>
    </div>
  );
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
