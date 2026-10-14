import type { DataTableColumn } from '../../../components/ui/DataTable';
import type { RhythmBar } from '../../../components/ui/RhythmChart';
import { WidgetSpark } from '../../../components/ui/Widget';
import type { LocaleId } from '../../../i18n';
import type { RosterStrings } from '../../../i18n/coachRoster';
import { coachDayMonth } from '../../format';
import { liftTrend, type LiftSummary, type SessionSummary } from '../../domain/history';

/** Columns of the lifts table (lift, target, e1RM, trend sparkline). */
export function liftColumns(
  r: RosterStrings,
  kg: (v: number) => string,
): DataTableColumn<LiftSummary>[] {
  return [
    { id: 'lift', header: r.c3ColLift, strong: true, cell: (l) => l.name },
    {
      id: 'target',
      header: r.c3ColTarget,
      muted: true,
      cell: (l) => r.c3Target(String(l.target.kg), l.target.reps),
    },
    { id: 'e1rm', header: r.c3ColE1rm, align: 'end', strong: true, cell: (l) => kg(l.e1rm) },
    {
      id: 'trend',
      header: r.c3ColTrend,
      cell: (l) => {
        const flat = liftTrend(l.series) === 'flat';
        return (
          <span
            className="c3-spark"
            role="img"
            aria-label={
              flat ? r.c3TrendFlat(l.e1rm) : r.c3TrendRising(l.e1rm - l.series[0], l.series.length)
            }
          >
            <WidgetSpark
              points={[...l.series]}
              tone={flat ? 'danger' : 'ok'}
              width={96}
              height={24}
              area
            />
          </span>
        );
      },
    },
  ];
}

/** Columns of the recent-sessions table. */
export function sessionColumns(
  r: RosterStrings,
  locale: LocaleId,
  tonnes: (v: number) => string,
): DataTableColumn<SessionSummary>[] {
  return [
    { id: 'date', header: r.c3ColDate, cell: (s) => coachDayMonth(s.at, locale) },
    { id: 'title', header: r.c3ColSession, cell: (s) => s.title },
    { id: 'sets', header: r.c3ColSets, align: 'end', cell: (s) => s.sets },
    {
      id: 'ton',
      header: r.c3ColTonnage,
      align: 'end',
      strong: true,
      cell: (s) => tonnes(s.tonnageKg),
    },
  ];
}

/** Sessions done per week for the rhythm chart (past weeks, then "now"); null when there is nothing to draw. */
export function rhythmBarsOf(
  r: RosterStrings,
  weeks: readonly { done: number }[] | null | undefined,
  program: boolean,
  doneNow: number,
): RhythmBar[] | null {
  return weeks && !program
    ? [
        ...weeks.map((w, i) => {
          const label = r.c3WeekAgo(weeks.length - i);
          return {
            label,
            value: w.done,
            ariaLabel: r.c3RhythmBar(label, w.done),
          };
        }),
        {
          label: r.c3Now,
          value: doneNow,
          current: true,
          ariaLabel: r.c3RhythmBar(r.c3Now, doneNow),
        },
      ]
    : null;
}
