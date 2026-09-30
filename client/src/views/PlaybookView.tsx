/**
 * Playbook — routines LEARNED from real history (see playbook.ts). A peer tab
 * of Programs/Exercises, and the prominent entry on Today. Each play is a rich
 * card: the exercises you reliably do on that day with a target set×rep scheme
 * and a representative recent top weight, a muscle-coverage read, and smart
 * nudges (a gap the day usually covers, a favourite lift you left out, a stalled
 * lift worth varying). Below the plays, a deduped "repeat a past session" strip
 * keeps exact one-tap replay one reach away.
 */
import { Card } from '../components/ui/Card';
import { Tag } from '../components/ui/Tag';
import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import type { Shell } from '../App';
import { useConditionLimits } from '../healthBuild';
import { exerciseFlag } from '../conditions';
import type { Workout } from '../types';
import { programDayNameFor, repeatWorkout, useStore, workoutDayReadout } from '../store';
import { startPlaySession } from '../data/programMine';
import { computePlaybook, type Play, type PlaySuggestion } from '../playbook';
import { fmtKg, fmtShortDate, fmtWeekday, useT } from '../i18n';
import { dayReadoutLabel } from '../data/daySuggest';
import { MuscleSetChip, withMuscleBreak } from '../components/Muscle';
import { ProgramsTabs, type ProgramsPeer } from '../components/ProgramsTabs';
import { Icon, useExerciseName } from '../ui';
import { useGymStep } from '../components/useGymStep';
import { ListRow } from '../components/ui/GroupedList';
import { Chip } from '../components/ui/Chip';

/** Day-type colour coding: push gold · pull blue · legs green · core violet · full gold. */
const DAY_TONE: Record<string, 'accent' | 'rest' | 'ok' | 'sleep' | 'neutral'> = {
  push: 'accent',
  pull: 'rest',
  legs: 'ok',
  core: 'sleep',
  full: 'accent',
};

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
  const exName = useExerciseName();
  const store = useStore();
  const limits = useConditionLimits();
  const careOf = (name: string) =>
    limits.keys.length > 0 && exerciseFlag(name, limits).level !== 'ok';

  const [now] = useState(() => Date.now());
  const finished = useMemo(
    () => store.workouts.filter((w) => w.finishedAt !== null),
    [store.workouts],
  );
  const { plays, recent } = useMemo(() => computePlaybook(finished, now), [finished, now]);

  const playName = (p: Play) =>
    p.name ?? (p.readout ? dayReadoutLabel(p.readout, t) : t.playUntitled);

  const { withGym, gymPicker } = useGymStep();
  const startPlay = (p: Play) =>
    void withGym((gymId) => {
      const id = startPlaySession(p, t.defaultTimedExerciseNames.warmup, gymId);
      if (id) shell.openOverlay({ screen: 'session', workoutId: id });
    });

  const repeat = (id: string) => {
    const nw = repeatWorkout(id);
    if (nw) shell.openOverlay({ screen: 'session', workoutId: nw.id });
  };

  const openMuscle = (muscle: Parameters<typeof MuscleSetChip>[0]['muscle']) =>
    shell.openOverlay({ screen: 'muscle-history', muscle });

  const recentTitle = (w: Workout) => {
    const dn = programDayNameFor(w, store.workouts);
    if (dn) return dn;
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
              <Card
                as="section"
                className="pb-play"
                key={p.id}
                tone={DAY_TONE[p.dayType ?? 'other'] ?? 'neutral'}
                data-day={p.dayType ?? 'other'}
              >
                <div className="pb-play-head">
                  <div className="pb-play-id">
                    <span className="pb-play-name">{playName(p)}</span>
                    <span className="pb-play-meta">
                      {t.playFromSessions(p.sessions)} · {fmtShortDate(p.lastTrainedAt, locale)}
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="pb-start"
                    onClick={() => startPlay(p)}
                  >
                    <Icon name="barbell" />
                    {t.playStart}
                  </Button>
                </div>

                <div className="pb-ex-list">
                  {p.exercises.map((ex, i) => (
                    <div className="pb-ex" key={ex.name}>
                      <span className="pb-ex-i">{i + 1}</span>
                      <span className="pb-ex-name">
                        {exName(ex.name)}
                        {careOf(ex.name) && (
                          <span className="pg-care" title={t.pickCareful}>
                            <Icon name="shield-check" />
                          </span>
                        )}
                        {ex.staple && (
                          <span className="pb-ex-star" title={t.playStaple} aria-hidden>
                            ●
                          </span>
                        )}
                      </span>
                      <Tag tone="accent" className="pb-ex-scheme">
                        {ex.sets} ×{' '}
                        {ex.repLow === ex.repHigh ? ex.repLow : `${ex.repLow}–${ex.repHigh}`}
                      </Tag>
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
                          detail
                        />
                      ))}
                    </div>
                  </div>
                )}

                {p.suggestions.length > 0 && (
                  <div className="pb-ideas">
                    <span className="pb-ideas-label">{t.playIdeas}</span>
                    {p.suggestions.map((s, i) => (
                      <Chip
                        key={i}
                        size="sm"
                        tone={s.kind === 'swap' ? 'accent' : 'neutral'}
                        icon={ideaIcon(s)}
                      >
                        {ideaText(s, t)}
                      </Chip>
                    ))}
                  </div>
                )}
              </Card>
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
                <ListRow
                  key={w.id}
                  dense
                  label={recentTitle(w)}
                  sub={names || undefined}
                  value={fmtShortDate(w.startedAt, locale)}
                  trailing={<Icon name="arrow-counter-clockwise" />}
                  onClick={() => repeat(w.id)}
                />
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
      {gymPicker}
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
