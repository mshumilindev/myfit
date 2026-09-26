/**
 * Overview — the hub tab (design "Spotter — Start Sheet" › Overview · Bento).
 * One glanceable tile per training surface that used to be spread over the
 * Progress and Programs tabs and their sub-tabs: Progress (weekly volume),
 * Trends (risks), Records (best est. 1RM), the program week, Goals, Playbook
 * and the Exercises library. Each tile drills into that page, which carries a
 * "‹ Overview" back link.
 */
import { dateInWeek, useWeekStartDay, weekOrder, weekStartOf } from '../weekStart';
import { useMemo, useState } from 'react';
import type { Shell } from '../App';
import type { ProgSeg } from '../App';
import type { ProgramsPeer } from '../components/ProgramsTabs';
import {
  dayKey,
  estimatedOneRepMaxSet,
  myExercises,
  setBestE1rm,
  useStore,
  workoutVolumeKg,
} from '../store';
import { computeTrends } from '../trends';
import { computePlaybook } from '../playbook';
import { focusCounts } from '../goals';
import { BUILT_IN_CATALOG } from '../data/exercises';
import {
  programDayHasPlan,
  programDayName,
  useProgramMine,
  type ProgramAssignment,
} from '../data/programMine';
import { fmtWeekday, fmtWeekdayShort, useT } from '../i18n';
import { Icon, useExerciseName } from '../ui';

const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Older weeks graphite, the recent ones brightening toward the accent.
const BAR_TONES = ['n', 'n', 'n', 'n', 'a1', 'a2', 'a2', 'a3'];

export function OverviewView({
  onProgress,
  onTrends,
  onPrograms,
}: {
  shell: Shell;
  onProgress: (seg: ProgSeg) => void;
  onTrends: () => void;
  onPrograms: (peer: ProgramsPeer) => void;
}) {
  const { t, locale } = useT();
  const exName = useExerciseName();
  const store = useStore();
  const { assignment, active } = useProgramMine();
  const [now] = useState(() => Date.now());
  const finished = useMemo(
    () => store.workouts.filter((w) => w.finishedAt !== null),
    [store.workouts],
  );

  // Progress — weekly volume, last 8 weeks (current last).
  const thisWeek = weekStartOf(now);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = thisWeek - (7 - i) * WEEK_MS;
    return finished
      .filter((w) => weekStartOf(w.startedAt) === start)
      .reduce((v, w) => v + workoutVolumeKg(w), 0);
  });
  const maxWeek = Math.max(...weeks, 1);

  // Trends — actionable insights (risks + warnings), the same count Today's
  // training-check card surfaces.
  const trends = useMemo(
    () => computeTrends(finished, store.bodyMetrics, now),
    [finished, store.bodyMetrics, now],
  );
  const actionable = trends.insights.filter((i) => i.level === 'risk' || i.level === 'warn');
  const hasRisk = trends.ready && actionable.length > 0;

  // Records — the heaviest estimated 1RM across all lifts.
  const topLift = useMemo(() => {
    let best: { name: string; rm: number } | null = null;
    for (const w of finished) {
      for (const e of w.exercises) {
        const top = estimatedOneRepMaxSet(e.sets);
        if (!top) continue;
        const rm = setBestE1rm(top);
        if (!best || rm > best.rm) best = { name: e.name.trim(), rm };
      }
    }
    return best;
  }, [finished]);

  const plays = useMemo(() => computePlaybook(finished, now).plays, [finished, now]);
  const focus = focusCounts(store.goals);
  const focusN = focus.grow + focus.ease;
  const physique = store.goals.physique;
  const libCount = BUILT_IN_CATALOG.length;
  const mineCount = myExercises().length;

  const program = assignment && active ? assignment : null;

  return (
    <div className="screen ov-page">
      <h2 className="visually-hidden">{t.overviewTab}</h2>
      <div className="ov-grid ov-top">
        <button type="button" className="ov-tile ov-progress" onClick={() => onProgress('total')}>
          <span className="ov-hd">
            <span className="ov-k">{t.progress}</span>
            <Icon name="chart-line-up" />
          </span>
          <span>
            <span className="ov-big num">
              {(weeks[7] / 1000).toFixed(1)}
              <span className="ov-unit"> t</span>
            </span>
            <span className="ov-ts">{t.volumeThisWeek}</span>
          </span>
          <span className="ov-bars" aria-hidden>
            {weeks.map((v, i) => (
              <span
                key={i}
                className={`ov-bar tone-${BAR_TONES[i]}${i === 7 ? ' cur' : ''}`}
                style={{ height: `${Math.max((v / maxWeek) * 100, 6)}%` }}
              />
            ))}
          </span>
        </button>
        <button
          type="button"
          className={`ov-tile ov-trends${hasRisk ? ' is-risk' : ''}`}
          onClick={onTrends}
        >
          <span className="ov-hd">
            <span className="ov-k">{store.coach.enabled ? t.atlasName : t.trendsTab}</span>
            <Icon name="trend-up" />
          </span>
          <span>
            <span className="ov-tt">
              {!trends.ready
                ? t.trendsTab
                : hasRisk
                  ? t.ovTrendsRisks(actionable.length)
                  : t.ovTrendsClear}
            </span>
            <span className="ov-ts">
              {!trends.ready
                ? t.ovTrendsLocked
                : hasRisk
                  ? actionable[0].headline || actionable[0].kicker || ''
                  : (trends.insights[0]?.headline ?? '')}
            </span>
          </span>
        </button>
        <button type="button" className="ov-tile ov-records" onClick={() => onProgress('records')}>
          <span className="ov-hd">
            <span className="ov-k">{t.records}</span>
            <Icon name="trophy" />
          </span>
          <span>
            <span className="ov-tt">{t.ovRecordsTitle}</span>
            <span className="ov-ts">
              {topLift ? `${exName(topLift.name)} ${Math.round(topLift.rm)} kg` : t.ovRecordsEmpty}
            </span>
          </span>
        </button>
      </div>

      <ProgramTile
        program={program}
        finishedDays={finished.map((w) => w.startedAt)}
        now={now}
        onOpen={() => onPrograms('programs')}
        weekdayLabel={(ts) => fmtWeekdayShort(ts, locale)}
        weekdayLong={(ts) => fmtWeekday(ts, locale)}
      />

      <div className="ov-grid">
        <button type="button" className="ov-tile ov-sq" onClick={() => onPrograms('goals')}>
          <span className="ov-hd">
            <span className="ov-k">{t.goalsTab}</span>
            <Icon name="crosshair" />
          </span>
          <span>
            <span className="ov-tt">
              {physique ? (t.archetypes[physique.archetype]?.name ?? t.goalsTab) : t.goalsTab}
            </span>
            <span className="ov-ts">{focusN > 0 ? t.ovGoalsFocus(focusN) : t.ovGoalsNone}</span>
          </span>
        </button>
        <button type="button" className="ov-tile ov-sq" onClick={() => onPrograms('playbook')}>
          <span className="ov-hd">
            <span className="ov-k">{t.playbook}</span>
            <Icon name="cards" />
          </span>
          <span>
            <span className="ov-tt">
              {plays.length > 0 ? t.ovPlaybookPlays(plays.length) : t.playbook}
            </span>
            <span className="ov-ts">{plays.length > 0 ? t.ovPlaybookSub : t.ovPlaybookEmpty}</span>
          </span>
        </button>
      </div>

      <button type="button" className="ov-tile ov-row" onClick={() => onPrograms('exercises')}>
        <span className="ov-row-ic">
          <Icon name="barbell" />
        </span>
        <span className="ov-row-text">
          <span className="ov-tt">{t.exercisesTabLabel}</span>
          <span className="ov-ts">{t.ovExercisesSub(libCount, mineCount)}</span>
        </span>
        <Icon name="caret-right" className="ov-row-go" />
      </button>
    </div>
  );
}

/** The program week: one cell per weekday (day name or Rest), today lit. */
function ProgramTile({
  program,
  finishedDays,
  now,
  onOpen,
  weekdayLabel,
  weekdayLong,
}: {
  program: ProgramAssignment | null;
  finishedDays: number[];
  now: number;
  onOpen: () => void;
  weekdayLabel: (ts: number) => string;
  weekdayLong: (ts: number) => string;
}) {
  const { t } = useT();
  const weekStart = useWeekStartDay();
  const first = weekStartOf(now, weekStart);
  const todayWeekday = ((new Date(now).getDay() + 6) % 7) + 1;

  if (!program) {
    return (
      <button type="button" className="ov-tile ov-program is-empty" onClick={onOpen}>
        <span className="ov-hd">
          <span className="ov-k">{t.progTitle}</span>
          <Icon name="list-checks" />
        </span>
        <span>
          <span className="ov-tt">{t.ovProgramNone}</span>
          <span className="ov-ts">{t.ovProgramNoneSub}</span>
        </span>
      </button>
    );
  }

  const trainedToday = finishedDays.some((ts) => dayKey(ts) === dayKey(now));
  const todayPlan = programDayHasPlan(program, todayWeekday);
  const nameOf = (day: number) => programDayName(program, day, t.progDay);
  const footer = (() => {
    if (trainedToday) return t.ovProgramDone;
    if (todayPlan) return t.ovProgramToday(nameOf(todayWeekday));
    for (let k = 1; k <= 7; k++) {
      const day = ((todayWeekday - 1 + k) % 7) + 1;
      if (programDayHasPlan(program, day)) {
        return t.ovProgramRestNext(nameOf(day), weekdayLong(dateInWeek(first, day, weekStart)));
      }
    }
    return t.progRestDay;
  })();

  return (
    <button type="button" className="ov-tile ov-program" onClick={onOpen}>
      <span className="ov-hd">
        <span className="ov-k">{t.ovProgramKicker(program.program.name)}</span>
        <Icon name="list-checks" />
      </span>
      <span className="ov-week">
        {weekOrder(weekStart).map((day) => {
          const plan = programDayHasPlan(program, day);
          return (
            <span
              key={day}
              className={`ov-day${day === todayWeekday ? ' is-today' : ''}${plan ? '' : ' is-rest'}`}
            >
              <span className="ov-dl">{weekdayLabel(dateInWeek(first, day, weekStart))}</span>
              <span className="ov-dn">{plan ? nameOf(day) : t.progRestShort}</span>
            </span>
          );
        })}
      </span>
      <span className="ov-ts">{footer}</span>
    </button>
  );
}
