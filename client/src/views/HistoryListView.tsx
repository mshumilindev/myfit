/**
 * Full workout history — every finished session, newest first, grouped by
 * month. Reached from the "See all" link under the Today history preview
 * (which shows only the last few). Each row opens the past workout.
 */
import { useMemo, useState } from 'react';
import type { Shell } from '../App';
import {
  deleteActivity,
  latestWeight,
  muscleWorkSorted,
  programDayNameFor,
  useStore,
  workoutDayReadout,
  workoutSets,
  workoutVolumeKg,
} from '../store';
import { fmtDurationHM, fmtKg, fmtShortDate, fmtWeekday, useT } from '../i18n';
import { dayReadoutLabel } from '../data/daySuggest';
import { MuscleRow } from '../components/Muscle';
import { ConfirmDialog, Icon } from '../ui';
import {
  activityType,
  activityCategory,
  activityCalories,
  liftingCalories,
  durationMin as activityDurationMin,
} from '../activities';
import type { Activity, Workout } from '../types';

type HistItem = { kind: 'w'; ts: number; w: Workout } | { kind: 'a'; ts: number; a: Activity };

export function HistoryListView({ shell, onClose }: { shell: Shell; onClose: () => void }) {
  const { t, locale } = useT();
  const store = useStore();

  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;

  // Merge finished workouts and activities into one timeline; activities read
  // as secondary rows to strength (design feature 6, KCAL feed).
  const items = useMemo<HistItem[]>(() => {
    const ws: HistItem[] = store.workouts
      .filter((w) => w.finishedAt !== null)
      .map((w) => ({ kind: 'w', ts: w.startedAt, w }));
    const as: HistItem[] = store.activities
      .filter((a) => a.finishedAt !== null)
      .map((a) => ({ kind: 'a', ts: a.startedAt, a }));
    return [...ws, ...as].sort((x, y) => y.ts - x.ts);
  }, [store.workouts, store.activities]);

  const workoutCount = items.filter((i) => i.kind === 'w').length;

  const groups = useMemo(() => {
    const monthLabel = (ts: number) => {
      try {
        return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
          new Date(ts),
        );
      } catch {
        return '';
      }
    };
    const map = new Map<string, { label: string; items: HistItem[] }>();
    for (const it of items) {
      const d = new Date(it.ts);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = map.get(key);
      if (!g) {
        g = { label: monthLabel(it.ts), items: [] };
        map.set(key, g);
      }
      g.items.push(it);
    }
    return [...map.values()];
  }, [items, locale]);

  const title = (w: Workout) => {
    const dn = programDayNameFor(w, store.workouts);
    if (dn) return dn;
    const r = workoutDayReadout(w);
    return r ? dayReadoutLabel(r, t) : fmtWeekday(w.startedAt, locale);
  };

  const sessionMuscles = (w: Workout) => muscleWorkSorted(w);

  return (
    <div className="screen hist-list" style={{ gap: 'var(--space-5)' }}>
      <div className="hist-head">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="title-26">{t.tdHistory}</h2>
          <div className="hist-list-sub">{t.historyCount(workoutCount)}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="detail-muted">{t.noHistoryYet}</div>
      ) : (
        groups.map((g) => (
          <div className="hist-month" key={g.label}>
            <div className="section-label">{g.label}</div>
            <div className="hist-rows">
              {g.items.map((it) =>
                it.kind === 'w' ? (
                  <button
                    key={it.w.id}
                    className="recent-row"
                    onClick={() =>
                      shell.openOverlay({ screen: 'past-workout', workoutId: it.w.id })
                    }
                  >
                    <span className="d">{fmtShortDate(it.w.startedAt, locale)}</span>
                    <span style={{ flex: 1 }}>
                      <span className="name">{title(it.w)}</span>
                      <div className="stats">
                        {workoutSets(it.w)} {t.sets} · {fmtKg(workoutVolumeKg(it.w))}
                        {it.w.finishedAt
                          ? ` · ${fmtDurationHM(it.w.finishedAt - it.w.startedAt)}`
                          : ''}
                        {(() => {
                          const kc = it.w.finishedAt
                            ? liftingCalories((it.w.finishedAt - it.w.startedAt) / 60000, bodyKg)
                            : null;
                          return kc != null ? (
                            <span className="stat-kcal">
                              {' '}
                              · ~{kc} {t.kcalShort}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      {sessionMuscles(it.w).length > 0 && (
                        <MuscleRow entries={sessionMuscles(it.w)} />
                      )}
                    </span>
                    <Icon name="arrow-up-right" className="go" />
                  </button>
                ) : (
                  <ActivityHistRow key={it.a.id} a={it.a} bodyKg={bodyKg} t={t} locale={locale} />
                ),
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** A finished activity, rendered as a quiet secondary row in the timeline. */
function ActivityHistRow({
  a,
  bodyKg,
  t,
  locale,
}: {
  a: Activity;
  bodyKg: number | null;
  t: ReturnType<typeof useT>['t'];
  locale: ReturnType<typeof useT>['locale'];
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const cat = activityCategory(a);
  const kcal = a.calories ?? activityCalories(a, bodyKg);
  const min = Math.round(activityDurationMin(a));
  return (
    <div className={`ta-row cat-${cat}`}>
      <Icon name={activityType(a.type)?.icon ?? 'heartbeat'} />
      <span className="ta-main">
        <span className="ta-name">{t.actType[a.type] ?? a.type}</span>
        <span className="ta-sub">
          {fmtShortDate(a.startedAt, locale)} · {min} {t.minShort}
          {a.distanceKm ? ` · ${a.distanceKm} ${t.kmShort}` : ''} ·{' '}
          {cat === 'recovery' ? t.actRecovery : t.actConditioning}
        </span>
      </span>
      {kcal != null && (
        <span className="ta-kcal tnum">
          <Icon name="flame" weight="fill" />~{kcal}
        </span>
      )}
      <button
        className="ta-del"
        onClick={() => setConfirmDel(true)}
        aria-label={t.delete}
        title={t.delete}
      >
        <Icon name="trash" />
      </button>
      {confirmDel && (
        <ConfirmDialog
          title={t.actDeleteTitle}
          body={t.actDeleteBody}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            deleteActivity(a.id);
            setConfirmDel(false);
          }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}
