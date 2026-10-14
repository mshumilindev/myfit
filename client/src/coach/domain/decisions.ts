/**
 * Decision recording model (plan 8.3-8.4, R-BE-DEC-6/7/10/11). Immutable book + pure transitions.
 *  - "Decisions" (receipts) = `book.decisions`; list, summary and CSV are derived from it.
 *  - dismiss needs a reason from a closed set; the key is hidden 30 d unless the evidence strengthens.
 *  - snooze ("Wait a week") hides the key 7 d, unless severity rises or strength grows.
 *  - a program decision hides the key while it is being measured ("Decided").
 * No clock inside: `now` is always a parameter.
 */
import { DISMISS_DAYS, SNOOZE_DAYS, STRENGTHEN_MARGIN, WINDOW_BY_KIND } from './signalConfig';
import { DAY } from './time';
import type { Option, ProgramDiff } from './diff';
import type { Evidence, Severity, Signal, SignalKind } from './types';

export const DISMISS_REASONS = ['not-useful', 'already-handled', 'wrong-data'] as const;
export type DismissReason = (typeof DISMISS_REASONS)[number];

export type DecisionKind = 'program' | 'wait' | 'dismiss';
/** open field `status` of the decisions collection */
export type DecisionStatus = 'recorded' | 'snoozed' | 'dismissed';
export type OutcomeResult = 'improved' | 'no-clear-change' | 'declined' | 'measuring';
export interface Outcome {
  result: OutcomeResult;
  before?: number;
  after?: number;
  noiseKg?: number;
  /** why the result is "no clear change" without data */
  reason?: 'not-enough-sessions';
  measuredAt?: number;
  /** the window was extended once by 7 days */
  extended?: boolean;
}

export interface DecisionRecord {
  /** client-generated UUID (offline queue, upsert semantics) */
  id: string;
  clientId: string;
  kind: DecisionKind;
  status: DecisionStatus;
  decidedAt: number;
  /** null for dismiss / informational */
  windowEndsAt: number | null;
  signal: {
    key: string;
    kind: SignalKind;
    exerciseKey: string | null;
    severity: Severity;
    strength: number;
  };
  optionId: string | null;
  diff: ProgramDiff | null;
  /** text sent to the client together with the decision ('' = notice only) */
  message: string;
  reason: DismissReason | null;
  outcome: Outcome | null;
  /** snapshot "as it was when you decided" (<= 12 rows per category, with the level they were read under) */
  evidence: Evidence[];
}

const SEV_RANK: Record<Severity, number> = { good: 0, watch: 1, urgent: 2 };

interface Mute {
  until: number;
  severity: Severity;
  strength: number;
}
export interface DecisionBook {
  decisions: readonly DecisionRecord[];
  snoozed: Readonly<Record<string, Mute>>;
  dismissed: Readonly<
    Record<string, Mute & { reason: DismissReason | 'acknowledged'; at: number }>
  >;
  /** local data-quality flags from "Wrong data" (clientId -> at) */
  dataQuality: Readonly<Record<string, number>>;
}

export const emptyBook = (): DecisionBook => ({
  decisions: [],
  snoozed: {},
  dismissed: {},
  dataQuality: {},
});

const sigRef = (s: Signal) => ({
  key: s.key,
  kind: s.kind,
  exerciseKey: s.exerciseKey,
  severity: s.severity,
  strength: s.strength,
});

/** Insert-or-replace by id (idempotent: re-applying the same record changes nothing). */
function upsert(book: DecisionBook, rec: DecisionRecord): DecisionBook {
  const rest = book.decisions.filter((d) => d.id !== rec.id);
  return { ...book, decisions: [rec, ...rest].sort((a, b) => b.decidedAt - a.decidedAt) };
}

export interface RecordInput {
  id: string;
  signal: Signal;
  option: Option;
  now: number;
  message?: string;
  reason?: DismissReason | null;
}

/** Record a program decision. Starts the fixed follow-up window of the signal type. */
export function recordProgramDecision(book: DecisionBook, i: RecordInput): DecisionBook {
  if (i.option.kind !== 'program' || !i.option.diff) throw new Error('not-a-program-option');
  const days = WINDOW_BY_KIND[i.signal.kind];
  const rec: DecisionRecord = {
    id: i.id,
    clientId: i.signal.clientId,
    kind: 'program',
    status: 'recorded',
    decidedAt: i.now,
    windowEndsAt: days == null ? null : i.now + days * DAY,
    signal: sigRef(i.signal),
    optionId: i.option.id,
    diff: i.option.diff,
    message: i.message ?? '',
    reason: null,
    outcome: days == null ? null : { result: 'measuring' },
    evidence: i.signal.evidence.map((e) => ({ ...e, rows: e.rows.slice(0, 12) })),
  };
  return upsert(book, rec);
}

/** Undo right after recording: drops the record by id (a no-op when it is not there). */
export function removeDecision(book: DecisionBook, id: string): DecisionBook {
  if (!book.decisions.some((d) => d.id === id)) return book;
  return { ...book, decisions: book.decisions.filter((d) => d.id !== id) };
}

/** "Wait a week": hides the key for 7 days. */
export function snoozeSignal(
  book: DecisionBook,
  id: string,
  signal: Signal,
  now: number,
): DecisionBook {
  const until = now + SNOOZE_DAYS * DAY;
  const rec: DecisionRecord = {
    id,
    clientId: signal.clientId,
    kind: 'wait',
    status: 'snoozed',
    decidedAt: now,
    windowEndsAt: until,
    signal: sigRef(signal),
    optionId: 'wait',
    diff: null,
    message: '',
    reason: null,
    outcome: null,
    evidence: [],
  };
  return upsert(
    {
      ...book,
      snoozed: {
        ...book.snoozed,
        [signal.key]: { until, severity: signal.severity, strength: signal.strength },
      },
    },
    rec,
  );
}

/** Dismiss needs a reason from the closed set; anything else throws at the function boundary (R-BE-DEC-7). */
export function dismissSignal(
  book: DecisionBook,
  id: string,
  signal: Signal,
  reason: DismissReason,
  now: number,
): DecisionBook {
  if (!(DISMISS_REASONS as readonly string[]).includes(reason))
    throw new Error('dismiss-reason-required');
  const mute = {
    until: now + DISMISS_DAYS * DAY,
    severity: signal.severity,
    strength: signal.strength,
    reason,
    at: now,
  };
  const rec: DecisionRecord = {
    id,
    clientId: signal.clientId,
    kind: 'dismiss',
    status: 'dismissed',
    decidedAt: now,
    windowEndsAt: null,
    signal: sigRef(signal),
    optionId: 'dismiss',
    diff: null,
    message: '',
    reason,
    outcome: null,
    evidence: [],
  };
  return upsert(
    {
      ...book,
      dismissed: { ...book.dismissed, [signal.key]: mute },
      dataQuality:
        reason === 'wrong-data'
          ? { ...book.dataQuality, [signal.clientId]: now }
          : book.dataQuality,
    },
    rec,
  );
}

/** Informational signals (new record) can only be acknowledged: same 30 d suppression, no reason asked. */
export function acknowledgeSignal(book: DecisionBook, signal: Signal, now: number): DecisionBook {
  return {
    ...book,
    dismissed: {
      ...book.dismissed,
      [signal.key]: {
        until: now + DISMISS_DAYS * DAY,
        severity: signal.severity,
        strength: signal.strength,
        reason: 'acknowledged',
        at: now,
      },
    },
  };
}

/** Replace a decision's outcome (after measurement). */
export function withOutcome(
  book: DecisionBook,
  id: string,
  outcome: Outcome,
  windowEndsAt?: number,
): DecisionBook {
  const d = book.decisions.find((x) => x.id === id);
  if (!d) return book;
  return upsert(book, { ...d, outcome, windowEndsAt: windowEndsAt ?? d.windowEndsAt });
}

export type SignalState = 'open' | 'decided' | 'snoozed' | 'dismissed';
export interface AnnotatedSignal {
  signal: Signal;
  state: SignalState;
  /** the decision that covers it, for "Decided" -> decision record */
  decisionId?: string;
}

const strengthened = (s: Signal, m: Mute) =>
  SEV_RANK[s.severity] > SEV_RANK[m.severity] || s.strength >= m.strength + STRENGTHEN_MARGIN;

export function signalState(book: DecisionBook, s: Signal, now: number): AnnotatedSignal {
  const dec = book.decisions.find(
    (d) =>
      d.signal.key === s.key &&
      d.kind === 'program' &&
      (d.outcome == null || d.outcome.result === 'measuring'),
  );
  if (dec) return { signal: s, state: 'decided', decisionId: dec.id };
  const dis = book.dismissed[s.key];
  if (dis && dis.until > now && !strengthened(s, dis)) return { signal: s, state: 'dismissed' };
  const sn = book.snoozed[s.key];
  if (sn && sn.until > now && !strengthened(s, sn)) return { signal: s, state: 'snoozed' };
  return { signal: s, state: 'open' };
}

export const annotateSignals = (
  book: DecisionBook,
  signals: readonly Signal[],
  now: number,
): AnnotatedSignal[] => signals.map((s) => signalState(book, s, now));

/** Signals the trainer still has to look at (Today, queue). */
export const openSignals = (
  book: DecisionBook,
  signals: readonly Signal[],
  now: number,
): Signal[] =>
  annotateSignals(book, signals, now)
    .filter((a) => a.state === 'open')
    .map((a) => a.signal);

/** Pipeline stage, DERIVED from signal state + decision outcome, never stored (R-BE-DEC-11). */
export type Stage = 'signal' | 'decided' | 'measuring' | 'result';
export function stageOfDecision(d: DecisionRecord): Stage {
  if (d.kind !== 'program') return 'decided';
  const r = d.outcome?.result;
  if (!r || r === 'measuring') return 'measuring';
  return 'result';
}

/** Decisions summary (counts reconcile by construction: total === sum of the four). */
export function summarizeDecisions(decisions: readonly DecisionRecord[]) {
  const measured = decisions.filter((d) => d.kind === 'program');
  const count = (r: OutcomeResult) =>
    measured.filter((d) => (d.outcome?.result ?? 'measuring') === r).length;
  const improved = count('improved');
  const noChange = count('no-clear-change');
  const declined = count('declined');
  const measuring = count('measuring');
  return { total: measured.length, improved, noChange, declined, measuring };
}
