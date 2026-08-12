/**
 * Full workout history — every finished session, newest first, grouped by
 * month. Reached from the "See all" link under the Today history preview
 * (which shows only the last few). Each row opens the past workout.
 */
import { useMemo } from 'react';
import type { Shell } from '../App';
import { useStore, workoutDayReadout, workoutSets, workoutVolumeKg } from '../store';
import { fmtDurationHM, fmtKg, fmtShortDate, fmtWeekday, useT } from '../i18n';
import { dayReadoutLabel } from '../data/daySuggest';
import { Icon } from '../ui';

export function HistoryListView({ shell, onClose }: { shell: Shell; onClose: () => void }) {
  const { t, locale } = useT();
  const store = useStore();

  const finished = useMemo(
    () =>
      store.workouts.filter((w) => w.finishedAt !== null).sort((a, b) => b.startedAt - a.startedAt),
    [store.workouts],
  );

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
    const map = new Map<string, { label: string; items: typeof finished }>();
    for (const w of finished) {
      const d = new Date(w.startedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = map.get(key);
      if (!g) {
        g = { label: monthLabel(w.startedAt), items: [] };
        map.set(key, g);
      }
      g.items.push(w);
    }
    return [...map.values()];
  }, [finished, locale]);

  const title = (w: (typeof finished)[number]) => {
    if (w.dayName) return w.dayName;
    const r = workoutDayReadout(w);
    return r ? dayReadoutLabel(r, t) : fmtWeekday(w.startedAt, locale);
  };

  return (
    <div className="screen hist-list" style={{ gap: 'var(--space-5)' }}>
      <div className="hist-head">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="title-26">{t.tdHistory}</h2>
          <div className="hist-list-sub">{t.historyCount(finished.length)}</div>
        </div>
      </div>

      {finished.length === 0 ? (
        <div className="detail-muted">{t.noHistoryYet}</div>
      ) : (
        groups.map((g) => (
          <div className="hist-month" key={g.label}>
            <div className="section-label">{g.label}</div>
            <div className="hist-rows">
              {g.items.map((w) => (
                <button
                  key={w.id}
                  className="recent-row"
                  onClick={() => shell.openOverlay({ screen: 'past-workout', workoutId: w.id })}
                >
                  <span className="d">{fmtShortDate(w.startedAt, locale)}</span>
                  <span style={{ flex: 1 }}>
                    <span className="name">{title(w)}</span>
                    <div className="stats">
                      {workoutSets(w)} {t.sets} · {fmtKg(workoutVolumeKg(w))}
                      {w.finishedAt ? ` · ${fmtDurationHM(w.finishedAt - w.startedAt)}` : ''}
                    </div>
                  </span>
                  <Icon name="arrow-up-right" className="go" />
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
