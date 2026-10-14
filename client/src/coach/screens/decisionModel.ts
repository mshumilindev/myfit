/**
 * Decision list rows and the words of a Decision record (S-19). One place maps a stored `DecisionRecord` to
 * localised text, so the Decisions screen and the Client 360 Decisions tab say the same thing.
 */
import type { C360Strings } from '../../i18n/coachClient360';
import type { RosterStrings } from '../../i18n/coachRoster';
import type { TodayStrings } from '../../i18n/coachToday.en';
import type { ChipTone } from '../../components/ui/Chip';
import type { DerivedWorld } from '../data/deriveWorld';
import type { DecisionRecord, OutcomeResult } from '../domain/decisions';
import { NOISE_KG, WINDOW_DAYS } from '../domain/signalConfig';
import { DAY } from '../domain/time';
import { decisionTitle } from '../today/signalCopy';

export type DecisionResult = OutcomeResult | 'waiting';

/** What a row reports: wait decisions have no measured result. */
export const resultOf = (d: DecisionRecord): DecisionResult =>
  d.kind === 'wait'
    ? 'waiting'
    : (d.outcome?.result ?? (d.windowEndsAt == null ? 'no-clear-change' : 'measuring'));

export const RESULT_TONE: Record<DecisionResult, ChipTone> = {
  improved: 'ok',
  declined: 'danger',
  measuring: 'rest',
  'no-clear-change': 'neutral',
  waiting: 'neutral',
};

export interface DecisionRow {
  rec: DecisionRecord;
  name: string;
  hasPhoto?: boolean;
  result: DecisionResult;
  title: string;
}

export function decisionRows(world: DerivedWorld, t: TodayStrings): DecisionRow[] {
  const people = new Map(world.rows.map((x) => [x.client.id, x.client]));
  return world.decisions
    .filter((x) => (x.kind === 'program' || x.kind === 'wait') && people.has(x.clientId))
    .map((x) => {
      const c = people.get(x.clientId)!;
      return {
        rec: x,
        name: c.name,
        hasPhoto: c.hasPhoto,
        result: resultOf(x),
        title: (x.kind === 'wait' ? t.optWait : decisionTitle(t, x.diff, x.optionId)).replace(
          /\.$/,
          '',
        ),
      };
    });
}

export const resultLabel = (t: TodayStrings, d: { dcWaiting: string }, r: DecisionResult): string =>
  ({
    improved: t.improved,
    declined: t.declined,
    measuring: t.measuring,
    'no-clear-change': t.noChange,
    waiting: d.dcWaiting,
  })[r];

const kg1 = (n: number): string => String(Math.round(n * 10) / 10);

/** Total follow-up days of a decision, or null when it is not measured. */
export const followUpTotal = (rec: DecisionRecord): number | null =>
  rec.kind !== 'program' || rec.windowEndsAt == null
    ? null
    : Math.max(1, Math.round((rec.windowEndsAt - rec.decidedAt) / DAY));

export interface FollowUp {
  closed: boolean;
  day: number;
  total: number;
}
export function followUpOf(rec: DecisionRecord, now: number): FollowUp | null {
  const total = followUpTotal(rec);
  if (total == null) return null;
  const closed = resultOf(rec) !== 'measuring';
  const day = closed
    ? total
    : Math.min(total, Math.max(1, Math.floor((now - rec.decidedAt) / DAY) + 1));
  return { closed, day, total };
}

/** "Follow-up" column of the CSV / list: Closed | Day 4 of 14 | none. */
export const followUpText = (c: C360Strings, f: FollowUp | null): string =>
  !f ? c.drNoFollowUp : f.closed ? c.drClosed : c.drDay(f.day, f.total);

/** First data label of the saved evidence (the exercise or muscle), if any. */
const subject = (rec: DecisionRecord): string | null => rec.evidence[0]?.rows[0]?.label ?? null;

export function whatText(c: C360Strings, r: RosterStrings, rec: DecisionRecord): string {
  const kind = r.sgKind[rec.signal.kind];
  const ex = ['stall', 'machine', 'ready', 'pr', 'injury'].includes(rec.signal.kind)
    ? subject(rec)
    : null;
  return c.drWhatKind(kind, ex);
}

/** The evidence as it was saved: "Bench press: 114 to 116 kg across 3 entries." */
export function evidenceText(c: C360Strings, rec: DecisionRecord): string {
  const ev = rec.evidence.find((e) => e.rows.length > 0);
  if (!ev) return c.drEvidenceNone;
  const vals = ev.rows.map((x) => x.value);
  const unit = c.drUnit[ev.rows[0].unit];
  const fmt = (v: number) => `${kg1(v)} ${unit}`;
  return c.drEvidenceLine(
    ev.rows[0].label,
    fmt(Math.min(...vals)),
    fmt(Math.max(...vals)),
    ev.rows.length,
  );
}

export function resultText(c: C360Strings, rec: DecisionRecord, now: number): string {
  if (rec.kind === 'wait') return c.drResWaiting;
  const f = followUpOf(rec, now);
  if (!f) return c.drResNone;
  const o = rec.outcome;
  if (!f.closed) return c.drResMeasuring(f.day, f.total);
  const e1 = rec.signal.kind !== 'rhythm' && rec.signal.kind !== 'spike';
  if (o?.reason === 'not-enough-sessions') return c.drResNotEnough;
  if (e1 && o?.before != null && o.after != null) {
    if (o.result === 'improved') return c.drResImproved(kg1(o.before), kg1(o.after));
    if (o.result === 'declined') return c.drResDeclined(kg1(o.before), kg1(o.after));
    return c.drResSameData(kg1(o.before), kg1(o.after));
  }
  return c.drResSame(f.total || WINDOW_DAYS);
}

export const noiseText = (c: C360Strings): string => c.drNoise(kg1(NOISE_KG));

/** "Deloads worked most often (8 of 10), more than exercise swaps (9 of 17)." Only when the numbers support it. */
export function insightOf(c: C360Strings, rows: readonly DecisionRow[]): string | null {
  const label = {
    deload: c.drKindDeload,
    swap: c.drKindSwap,
    add: c.drKindAdd,
    weight: c.drKindWeight,
    sets: c.drKindSets,
  } as const;
  const tally = new Map<keyof typeof label, { n: number; ok: number }>();
  for (const r of rows) {
    const op = r.rec.diff?.ops[0]?.op;
    if (!op || r.result === 'measuring' || r.result === 'waiting') continue;
    const x = tally.get(op) ?? { n: 0, ok: 0 };
    x.n += 1;
    if (r.result === 'improved') x.ok += 1;
    tally.set(op, x);
  }
  const ranked = [...tally.entries()]
    .filter(([, v]) => v.n >= 5)
    .sort((a, b) => b[1].ok / b[1].n - a[1].ok / a[1].n || b[1].n - a[1].n);
  if (ranked.length < 2) return null;
  const [[ka, a], [kb, b]] = ranked;
  if (a.ok / a.n <= b.ok / b.n) return null;
  const up = (x: string) => x.charAt(0).toLocaleUpperCase() + x.slice(1);
  const low = (x: string) => x.charAt(0).toLocaleLowerCase() + x.slice(1);
  return c.drInsight(up(label[ka]), a.ok, a.n, low(label[kb]), b.ok, b.n);
}

export type GroupBy = 'none' | 'client' | 'result' | 'trigger' | 'month';
export const GROUPS: readonly GroupBy[] = ['none', 'client', 'result', 'trigger', 'month'];

const RESULT_ORDER: DecisionResult[] = [
  'improved',
  'measuring',
  'waiting',
  'no-clear-change',
  'declined',
];
const TRIGGER_ORDER = [
  'stall',
  'rhythm',
  'injury',
  'machine',
  'spike',
  'ready',
  'pr',
  'nodata',
] as const;

/** UTC "2026-10": decisions are dated in the world clock (fixtures are built in UTC). */
const monthKey = (ts: number): string => new Date(ts).toISOString().slice(0, 7);

export interface DecisionGroup {
  /** stable id of the group (client id, result, trigger kind, "2026-10") */
  key: string;
  rows: DecisionRow[];
}

/**
 * Split rows into groups. Rows keep their order (newest first) inside a group. Groups: clients A to Z, results
 * from good to bad, triggers in the signal order, months newest first. `none` is one group with an empty key.
 */
export function groupDecisions(rows: readonly DecisionRow[], by: GroupBy): DecisionGroup[] {
  if (by === 'none') return rows.length ? [{ key: '', rows: [...rows] }] : [];
  const keyOf = (x: DecisionRow): string =>
    by === 'client'
      ? x.rec.clientId
      : by === 'result'
        ? x.result
        : by === 'trigger'
          ? x.rec.signal.kind
          : monthKey(x.rec.decidedAt);
  const map = new Map<string, DecisionRow[]>();
  for (const x of rows) map.set(keyOf(x), [...(map.get(keyOf(x)) ?? []), x]);
  const rank = (k: string): number =>
    by === 'result'
      ? RESULT_ORDER.indexOf(k as DecisionResult)
      : by === 'trigger'
        ? TRIGGER_ORDER.indexOf(k as (typeof TRIGGER_ORDER)[number])
        : 0;
  const name = (k: string) => map.get(k)![0].name;
  return [...map.keys()]
    .sort((a, b) =>
      by === 'client'
        ? name(a).localeCompare(name(b))
        : by === 'month'
          ? b.localeCompare(a)
          : rank(a) - rank(b),
    )
    .map((key) => ({ key, rows: map.get(key)! }));
}

/** "October 2026" for a month key, in the world's UTC clock. */
export function monthTitle(key: string, locale: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(y, m - 1, 1));
}
