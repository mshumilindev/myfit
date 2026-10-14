/**
 * Signal -> words. The domain carries machine facts only (no copy); this is the one place a signal,
 * an option and a diff turn into localised text. Pure: every function takes the dictionary.
 */
import type { TodayStrings } from '../../i18n/coachToday.en';
import type { LocaleId } from '../../i18n';
import { coachDayMonth } from '../format';
import type { DiffOp, Option } from '../domain/diff';
import { WINDOW_BY_KIND, NOISE_KG } from '../domain/signalConfig';
import { WEEK, weekStartOf } from '../domain/time';
import type { Evidence, EvidenceRow, Severity, Signal } from '../domain/types';
import type { Tone } from '../../components/ui/tones';
import type { ChartPoint, EvidenceTable } from '../../components/ui/EvidenceChart';

const str = (v: string | number | null | undefined): string => (v == null ? '' : String(v));
const num = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0);
export const kg = (n: number): string => String(Math.round(n * 10) / 10);

export interface SignalText {
  title: string;
  body: string;
  line: string;
}

export function signalText(t: TodayStrings, s: Signal): SignalText {
  const f = s.facts;
  switch (s.kind) {
    case 'stall': {
      const ex = str(f.exercise);
      return {
        title: t.sigStallTitle(ex, num(f.weeks)),
        body: t.sigStallBody(kg(num(f.e1rm)), num(f.weeks)),
        line: t.sigStallLine(ex, kg(num(f.e1rm)), num(f.weeks)),
      };
    }
    case 'machine': {
      const ex = str(f.exercise);
      return {
        title: t.sigMachineTitle,
        body: t.sigMachineBody(ex, kg(num(f.from)), kg(num(f.to))),
        line: t.sigMachineLine(ex, kg(num(f.to))),
      };
    }
    case 'rhythm': {
      const idle = f.idleDays == null ? null : num(f.idleDays);
      const low = num(f.lowWeeks) || 2;
      return {
        title: idle != null && idle > 7 ? t.sigRhythmIdleTitle(idle) : t.sigRhythmLowTitle,
        body: t.sigRhythmBody(low, idle),
        line: t.sigRhythmLine(idle),
      };
    }
    case 'spike': {
      const m = str(f.muscle);
      return {
        title: t.sigSpikeTitle(m, num(f.pct)),
        body: t.sigSpikeBody(m, num(f.sets), kg(num(f.chronic))),
        line: t.sigSpikeLine(m, num(f.sets), num(f.pct)),
      };
    }
    case 'ready': {
      const ex = str(f.exercise);
      return {
        title: t.sigReadyTitle(ex),
        body: t.sigReadyBody(num(f.sessions), num(f.maxRpe)),
        line: t.sigReadyLine(ex, num(f.maxRpe)),
      };
    }
    case 'pr': {
      const ex = str(f.exercise);
      return {
        title: t.sigPrTitle(ex, kg(num(f.e1rm))),
        body: t.sigPrBody(kg(num(f.gainKg)), kg(num(f.previous))),
        line: t.sigPrLine(ex, kg(num(f.gainKg))),
      };
    }
    case 'injury': {
      const ex = str(f.exercise);
      const n = num(f.conflicts) || 1;
      return {
        title: t.sigInjuryTitle(ex),
        body: t.sigInjuryBody(f.restriction == null ? null : str(f.restriction), n),
        line: t.sigInjuryLine(n),
      };
    }
    case 'nodata':
      return s.reason === 'sets-not-shared'
        ? {
            title: t.sigNoSetsTitle,
            body: t.sigNoSetsBody,
            line: t.sigNoSetsLine(f.rhythmDone == null ? null : num(f.rhythmDone)),
          }
        : { title: t.sigNoDataTitle, body: t.sigNoDataBody, line: t.sigNoDataLine };
  }
}

export const severityTone = (sev: Severity): Tone =>
  sev === 'urgent' ? 'danger' : sev === 'watch' ? 'illness' : 'ok';
export const severityWord = (t: TodayStrings, sev: Severity): string =>
  sev === 'urgent' ? t.urgent : sev === 'watch' ? t.watch : t.good;

/* ---- hero + chart ------------------------------------------------------------------------------------------- */

export interface Hero {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}

export function signalHero(t: TodayStrings, s: Signal): Hero | null {
  const f = s.facts;
  const first = s.evidence[0]?.rows[0];
  switch (s.kind) {
    case 'stall':
      return {
        label: t.heroLabel(str(f.exercise)),
        value: kg(num(f.e1rm)),
        unit: 'kg',
        sub: t.heroNoChange(num(f.weeks)),
      };
    case 'machine':
      return { label: t.heroLabel(str(f.exercise)), value: kg(num(f.to)), unit: 'kg' };
    case 'pr':
      return { label: t.heroLabel(str(f.exercise)), value: kg(num(f.e1rm)), unit: 'kg' };
    case 'ready':
      return first && first.unit === 'kg'
        ? { label: t.heroLabel(str(f.exercise)), value: kg(first.value), unit: 'kg' }
        : null;
    case 'spike':
      return {
        label: t.heroSets(str(f.muscle)),
        value: String(num(f.sets)),
        sub: t.heroSetsVs(kg(num(f.chronic))),
      };
    case 'rhythm':
      return f.idleDays == null ? null : { label: t.heroDays, value: String(num(f.idleDays)) };
    default:
      return null;
  }
}

export interface ChartModel {
  points: ChartPoint[];
  xStart: string;
  xEnd: string;
  unit: string;
  plan?: number;
  aria: string;
  table: EvidenceTable;
  /** Fewer than 3 points: the chart is replaced by the "needs 3" note. */
  notEnough: boolean;
  tone: 'neutral' | 'flag';
}

const MIN_POINTS = 3;
const SESSION_POINTS = 5;
const MAX_WEEK_POINTS = 8;

/** The chartable evidence of a signal (rows newest first in the domain; the chart runs oldest first). */
export function signalChart(
  t: TodayStrings,
  s: Signal,
  now: number,
  locale: LocaleId,
  /** `weekly`: one point per week (best of the week), "N weeks ago" to "This week" (Today card).
   *  `sessions`: the last few sessions with dates (Decision evidence). */
  mode: 'weekly' | 'sessions' = 'weekly',
): ChartModel | null {
  const ev: Evidence | undefined = s.evidence.find((e) => e.rows.length > 0);
  if (!ev) return null;
  const rows = ev.rows;
  const unit = rows[0].unit;
  if (unit !== 'kg' && unit !== 'sets' && unit !== 'sessions') return null;
  const oldestFirst = [...rows].reverse();
  const weeksAgo = (r: EvidenceRow, i: number): string => {
    if (r.at != null) return coachDayMonth(r.at, locale);
    return t.evWeeksAgo(oldestFirst.length - 1 - i);
  };
  const dated = oldestFirst.every((r) => r.at != null);
  const sessionsShown = mode === 'sessions' && dated && ev.granular && unit === 'kg';
  let points: ChartPoint[];
  let xStart: string;
  let xEnd = t.evThisWeek;
  if (sessionsShown) {
    const tail = oldestFirst.slice(-SESSION_POINTS);
    points = tail.map((r) => ({ label: coachDayMonth(r.at!, locale), value: r.value }));
    xStart = coachDayMonth(tail[0].at!, locale);
    xEnd = coachDayMonth(tail[tail.length - 1].at!, locale);
  } else if (dated) {
    // Weekly points: the best value of each week, so a busy week is one point and the line stays calm.
    const byWeek = new Map<number, number>();
    for (const r of oldestFirst) {
      const w = weekStartOf(r.at!);
      byWeek.set(w, Math.max(byWeek.get(w) ?? -Infinity, r.value));
    }
    const weeks = [...byWeek.entries()].sort((a, b) => a[0] - b[0]).slice(-MAX_WEEK_POINTS);
    const cur = weekStartOf(now);
    const ago = (w: number) => Math.max(0, Math.round((cur - w) / WEEK));
    points = weeks.map(([w, v]) => ({ label: t.evWeeksAgo(ago(w)), value: v }));
    xStart = t.evWeeksAgo(Math.max(1, ago(weeks[0][0])));
  } else {
    points = oldestFirst.map((r, i) => ({ label: weeksAgo(r, i), value: r.value }));
    xStart = t.evWeeksAgo(oldestFirst.length - 1);
  }
  const unitLabel =
    unit === 'kg' ? t.evChartUnit : unit === 'sets' ? t.evChartUnitSets : t.evChartUnitSessions;
  const plan = unit === 'sessions' ? planOf(rows) : undefined;
  const valueHead = unit === 'kg' ? t.evValue : unit === 'sets' ? t.evValueSets : t.evValueSessions;
  const firstCol = ev.granular ? t.evDate : t.evWeek;
  const table: EvidenceTable = {
    caption: t.evTable,
    head: unit === 'kg' ? [firstCol, t.evSets, valueHead] : [firstCol, valueHead],
    rows: rows.slice(0, sessionsShown ? 4 : 6).map((r, i) => {
      const label = weeksAgo(r, oldestFirst.length - 1 - i);
      const v = unit === 'kg' ? `${kg(r.value)} kg` : String(r.value);
      return unit === 'kg' ? [label, r.detail ?? '', v] : [label, v];
    }),
  };
  return {
    points,
    xStart,
    xEnd,
    unit: unitLabel,
    plan,
    aria: t.evChartAria(
      str(s.facts.exercise ?? s.facts.muscle ?? ''),
      kg(points[0].value),
      kg(points[points.length - 1].value),
      unit === 'kg' ? 'kg' : unitLabel,
    ),
    table,
    notEnough: points.length < MIN_POINTS,
    tone: s.kind === 'stall' && !sessionsShown ? 'flag' : 'neutral',
  };
}

function planOf(rows: readonly EvidenceRow[]): number | undefined {
  const m = /planned (\d+)/.exec(rows[0]?.detail ?? '');
  return m ? Number(m[1]) : undefined;
}

/* ---- options -------------------------------------------------------------------------------------------------- */

export function describeOpT(t: TodayStrings, op: DiffOp): string {
  switch (op.op) {
    case 'sets':
      return t.opSets(op.exercise, op.from, op.to);
    case 'add':
      return t.opAdd(op.exercise, op.sets, op.reps);
    case 'weight':
      return op.fromKg > 0
        ? t.opWeight(op.exercise, op.fromKg, op.toKg)
        : t.opWeightUp(op.exercise, Math.round((op.toKg - op.fromKg) * 10) / 10);
    case 'deload':
      return t.opDeload(op.pct, op.weeks);
    case 'swap':
      return t.opSwap(op.from, op.to === 'a restriction-safe alternative' ? t.opAltSafe : op.to);
  }
}

export const describeDiffT = (t: TodayStrings, ops: readonly DiffOp[]): string =>
  ops.map((o) => describeOpT(t, o)).join(' ');

const OPTION_TITLE = (t: TodayStrings): Record<string, string> => ({
  variation: t.optVariation,
  deload: t.optDeload,
  step: t.optStep,
  swap: t.optSwap,
  lighter: t.optLighter,
  wait: t.optWait,
  dismiss: t.optDismiss,
});

export interface OptionView {
  id: string;
  title: string;
  description: string;
  suggested: boolean;
}

/** Title by option id; the description IS the diff in words (one op = one sentence). */
export function optionView(t: TodayStrings, o: Option): OptionView {
  return {
    id: o.id,
    title: OPTION_TITLE(t)[o.id] ?? (o.diff ? describeDiffT(t, o.diff.ops) : o.label),
    description: o.diff ? describeDiffT(t, o.diff.ops) : '',
    suggested: !!o.suggested,
  };
}

/** Short title of a recorded decision (board cards): the diff in words, first op. */
export function decisionTitle(
  t: TodayStrings,
  diff: { ops: DiffOp[] } | null,
  optionId: string | null,
): string {
  if (diff && diff.ops.length) return describeOpT(t, diff.ops[0]);
  return optionId ? (OPTION_TITLE(t)[optionId] ?? optionId) : '';
}

export const followUpDays = (s: Signal): number | null => WINDOW_BY_KIND[s.kind];

/** The "Result check" sentence for the signal type (one configured threshold). */
export function resultStepText(t: TodayStrings, s: Signal): string | null {
  const days = followUpDays(s);
  if (days == null) return null;
  if (s.kind === 'rhythm') return t.resultStepRhythm(days);
  if (s.kind === 'spike') return t.resultStepSpike(days);
  return t.resultStep(days, kg(NOISE_KG));
}
