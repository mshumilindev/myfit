/** Test builders for the domain (no production code imports this). */
import { weekStartOf, DAY } from './time';
import type { ClientSignalInput, LiftSeries, LiftSession, LiftWeek } from './signalInputs';
import type { Consent, Level } from './types';
import { ALL_OFF } from './consent';

export const NOW = Date.UTC(2026, 9, 7, 9, 5); // Wed 7 Oct 2026 09:05
export const CUR = weekStartOf(NOW); // Mon 5 Oct
export const wkAgo = (n: number) => CUR - n * 7 * DAY;

export const consent = (c: Partial<Record<keyof Consent, Level>> = {}): Consent => ({
  ...ALL_OFF,
  ...c,
});

export const week = (
  n: number,
  bestE1rm: number,
  workingSets = 6,
  variant = 'v1',
  avgRpe: number | null = 8,
): LiftWeek => ({
  weekStart: wkAgo(n),
  bestE1rm,
  workingSets,
  avgRpe,
  variant,
});

/** completed weeks 4..1 weeks ago with the given bests, plus an optional current week */
export function lift(
  bests: number[],
  opts: { cur?: number; sets?: number[]; variants?: string[]; name?: string } = {},
): LiftSeries {
  const n = bests.length;
  const weeks = bests.map((b, i) =>
    week(n - i, b, opts.sets?.[i] ?? 6, opts.variants?.[i] ?? 'v1'),
  );
  if (opts.cur != null) weeks.push(week(0, opts.cur, 3, opts.variants?.[n] ?? 'v1'));
  return { liftId: 'bench', name: opts.name ?? 'Bench press', weeks };
}

export const session = (
  daysAgo: number,
  e1rm: number,
  rpe: number | null,
  o: Partial<LiftSession> = {},
): LiftSession => ({
  at: NOW - daysAgo * DAY,
  variant: 'v1',
  e1rm,
  workingSets: 3,
  rpe,
  allRepsDone: true,
  ...o,
});

export const input = (
  o: Partial<ClientSignalInput> & { clientId?: string } = {},
): ClientSignalInput => ({
  clientId: 'c1',
  mode: 'app',
  consent: consent({ totals: 'full', sets: 'full' }),
  ...o,
});

export const totals = (
  done: number[],
  planned = 3,
  daysSinceLast: number | null = 2,
  sessions4w?: number,
) => ({
  completedWeeks: done.map((d) => ({ done: d, planned })),
  plannedThisWeek: planned,
  daysSinceLast,
  sessionsLast4Weeks: sessions4w ?? done.slice(-4).reduce((a, b) => a + b, 0),
});
