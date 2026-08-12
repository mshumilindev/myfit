/**
 * Templates — every past session, repeatable into a fresh workout. Reached from
 * the Today start block. Tapping a template repeats it and opens the new session.
 */
import { useMemo } from 'react';
import type { Shell } from '../App';
import type { Workout } from '../types';
import { repeatWorkout, useStore, workoutDayReadout, workoutSets, workoutVolumeKg } from '../store';
import { fmtDayMonth, fmtDurationHM, fmtKg, fmtShortDate, fmtWeekday, useT } from '../i18n';
import { dayReadoutLabel } from '../data/daySuggest';
import { Icon } from '../ui';

export function TemplatesView({ shell, onClose }: { shell: Shell; onClose: () => void }) {
  const { t, locale } = useT();
  const store = useStore();

  const templates = useMemo(
    () =>
      store.workouts.filter((w) => w.finishedAt !== null).sort((a, b) => b.startedAt - a.startedAt),
    [store.workouts],
  );

  const title = (w: Workout) => {
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
          <h2 className="title-26">{t.templates}</h2>
          <div className="hist-list-sub">{t.templatesSaved(templates.length)}</div>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="detail-muted">{t.templatesHint}</div>
      ) : (
        <div className="tpl-list">
          {templates.map((w) => {
            const names = w.exercises
              .map((e) => e.name.trim())
              .filter(Boolean)
              .slice(0, 4)
              .join(' · ');
            const stats = `${workoutSets(w)} ${t.sets} · ${fmtKg(workoutVolumeKg(w))}${
              w.finishedAt ? ` · ${fmtDurationHM(w.finishedAt - w.startedAt)}` : ''
            }`;
            return (
              <button
                key={w.id}
                className="td-tpl"
                aria-label={`${t.loadTemplate}: ${fmtDayMonth(w.startedAt, locale)}`}
                onClick={() => {
                  const nw = repeatWorkout(w.id);
                  if (nw) shell.openOverlay({ screen: 'session', workoutId: nw.id });
                }}
              >
                <span className="td-tpl-date">{fmtShortDate(w.startedAt, locale)}</span>
                <span className="td-tpl-body">
                  <span className="n">{title(w)}</span>
                  {names && <span className="ex">{names}</span>}
                  <span className="meta">{stats}</span>
                </span>
                <span className="td-tpl-action">
                  <Icon name="arrow-counter-clockwise" />
                  <span className="visually-hidden">{t.loadTemplate}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
