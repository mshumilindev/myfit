/**
 * Playbook — routines LEARNED from real history (see playbook.ts). A peer tab
 * of Programs/Exercises, and the prominent entry on Today. Each play is a rich
 * card: the exercises you reliably do on that day with a target set×rep scheme
 * and a representative recent top weight, a muscle-coverage read, and smart
 * nudges (a gap the day usually covers, a favourite lift you left out, a stalled
 * lift worth varying). Below the plays, a deduped "repeat a past session" strip
 * keeps exact one-tap replay one reach away.
 */
import { useMemo, useState } from 'react';
import type { Shell } from '../App';
import type { Workout } from '../types';
import { addExercise, repeatWorkout, startWorkout, useStore, workoutDayReadout } from '../store';
import { computePlaybook, type Play, type PlaySuggestion } from '../playbook';
import { fmtKg, fmtShortDate, fmtWeekday, useT } from '../i18n';
import { dayReadoutLabel } from '../data/daySuggest';
import { MuscleSetChip, withMuscleBreak } from '../components/Muscle';
import { ProgramsTabs, type ProgramsPeer } from '../components/ProgramsTabs';
import { Icon } from '../ui';

export function PlaybookView({
  shell,
  onProgramsTab,
  embedded,
}: {
  shell: Shell;
  /** Peer-tab switch (Programs · Playbook · Exercises). Absent when embedded. */
  onProgramsTab?: (peer: ProgramsPeer) => void;
  /** Rendered inside another surface (no page chrome / tab bar). */
  embedded?: boolean;
}) {
  const { t, locale } = useT();
  const store = useStore();

  const [now] = useState(() => Date.now());
  const finished = useMemo(
    () => store.workouts.filter((w) => w.finishedAt !== null),
    [store.workouts],
  );
  const { plays, recent } = useMemo(() => computePlaybook(finished, now), [finished, now]);

  const playName = (p: Play) =>
    p.name ?? (p.readout ? dayReadoutLabel(p.readout, t) : t.playUntitled);

  const startPlay = (p: Play) => {
    const w = startWorkout(null, {
      dayName: p.name ?? undefined,
      targetMuscles: p.coverage.filter((c) => c.primary).map((c) => c.muscle),
    });
    for (const ex of p.exercises) {
      addExercise(w.id, ex.name, 'strength', {
        plannedSets: ex.sets,
        plannedReps: ex.repHigh || ex.repLow || null,
        primaryMuscle: ex.primary ?? undefined,
        secondaryMuscles: ex.secondary,
      });
    }
    shell.openOverlay({ screen: 'session', workoutId: w.id });
  };

  const repeat = (id: string) => {
    const nw = repeatWorkout(id);
    if (nw) shell.openOverlay({ screen: 'session', workoutId: nw.id });
  };

  const openMuscle = (muscle: Parameters<typeof MuscleSetChip>[0]['muscle']) =>
    shell.openOverlay({ screen: 'muscle-history', muscle });

  const recentTitle = (w: Workout) => {
    if (w.dayName) return w.dayName;
    const r = workoutDayReadout(w);
    return r ? dayReadoutLabel(r, t) : fmtWeekday(w.startedAt, locale);
  };

  const body = (
    <div className="pb-body">
      {plays.length === 0 ? (
        <div className="pb-empty">
          <Icon name="cards" />
          <p>{t.playEmpty}</p>
        </div>
      ) : (
        <>
          <div className="pb-sub">{t.playbookSubtitle(plays.length)}</div>
          <div className="pb-plays">
            {plays.map((p) => (
              <article className="pb-play" key={p.id} data-day={p.dayType ?? 'other'}>
                <div className="pb-play-head">
                  <div className="pb-play-id">
                    <span className="pb-play-name">{playName(p)}</span>
                    <span className="pb-play-meta">
                      {t.playFromSessions(p.sessions)} · {fmtShortDate(p.lastTrainedAt, locale)}
                    </span>
                  </div>
                  <button className="btn btn-primary pb-start" onClick={() => startPlay(p)}>
                    <Icon name="barbell" />
                    {t.playStart}
                  </button>
                </div>

                <div className="pb-ex-list">
                  {p.exercises.map((ex, i) => (
                    <div className="pb-ex" key={ex.name}>
                      <span className="pb-ex-i">{i + 1}</span>
                      <span className="pb-ex-name">
                        {ex.name}
                        {ex.staple && (
                          <span className="pb-ex-star" title={t.playStaple} aria-hidden>
                            ●
                          </span>
                        )}
                      </span>
                      <span className="pb-ex-scheme">
                        {ex.sets} ×{' '}
                        {ex.repLow === ex.repHigh ? ex.repLow : `${ex.repLow}–${ex.repHigh}`}
                      </span>
                      <span className="pb-ex-wt">
                        {ex.topWeight != null ? fmtKg(ex.topWeight) : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {p.coverage.length > 0 && (
                  <div className="pb-cover">
                    <span className="pb-cover-label">{t.playCoverage}</span>
                    <div className="pb-cover-row">
                      {withMuscleBreak(p.coverage.slice(0, 6), (c) => (
                        <MuscleSetChip
                          key={c.muscle}
                          muscle={c.muscle}
                          count={c.sets}
                          tone={c.primary ? 'primary' : 'secondary'}
                          onClick={openMuscle}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {p.suggestions.length > 0 && (
                  <div className="pb-ideas">
                    <span className="pb-ideas-label">{t.playIdeas}</span>
                    {p.suggestions.map((s, i) => (
                      <span className={`pb-idea ${s.kind === 'swap' ? 'warn' : ''}`} key={i}>
                        <Icon name={ideaIcon(s)} />
                        {ideaText(s, t)}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {recent.length > 0 && (
        <div className="pb-recent">
          <div className="section-label">{t.playRepeatTitle}</div>
          <div className="pb-recent-list">
            {recent.map((w) => {
              const names = w.exercises
                .map((e) => e.name.trim())
                .filter(Boolean)
                .slice(0, 4)
                .join(' · ');
              return (
                <button className="pb-recent-row" key={w.id} onClick={() => repeat(w.id)}>
                  <span className="pb-recent-body">
                    <span className="pb-recent-name">{recentTitle(w)}</span>
                    {names && <span className="pb-recent-ex">{names}</span>}
                  </span>
                  <span className="pb-recent-date">{fmtShortDate(w.startedAt, locale)}</span>
                  <Icon name="arrow-counter-clockwise" className="go" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="screen programs-page programs-author-page programs-has-tabs playbook-tab">
      <div className="programs-top">
        <div>
          <div className="kicker">{t.training}</div>
          <h2 className="title-26">{t.playbook}</h2>
        </div>
        <ProgramsTabs active="playbook" onSelect={(peer) => onProgramsTab?.(peer)} />
      </div>
      {body}
    </div>
  );
}

function ideaIcon(s: PlaySuggestion): string {
  if (s.kind === 'swap') return 'chart-line-up';
  if (s.reason === 'favorite') return 'barbell';
  return 'plus';
}

function ideaText(s: PlaySuggestion, t: ReturnType<typeof useT>['t']): string {
  if (s.kind === 'swap') return t.playIdeaPlateau(s.exercise);
  if (s.reason === 'favorite') return t.playIdeaFavorite(s.exercise);
  return t.playIdeaGap(t.muscleGroups[s.muscle]);
}
