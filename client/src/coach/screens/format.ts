/**
 * Copy for the roster / signals / Client 360 screens: turns machine values (levels, kinds, facts, timestamps)
 * into dictionary text. Pure; no React. Domain code never carries copy (M1-DATA rule), this is where it joins.
 */
import type { RosterStrings } from '../../i18n/coachRoster';
import type { ConsentItem, ConsentLevelId } from '../../components/ui/ConsentControls';
import type { RowStatus } from '../../components/ui/RosterRows';
import { effectiveConsent, sharingSummary } from '../domain/consent';
import { DAY } from '../domain/time';
import {
  CATEGORIES,
  type Category,
  type CoachClient,
  type Consent,
  type Dow,
  type LogMode,
  type RosterStatus,
  type Signal,
} from '../domain/types';

type R = RosterStrings;

export const statusLabel = (r: R, s: RosterStatus | RowStatus): string =>
  s === 'urgent'
    ? r.roStatusUrgent
    : s === 'watch'
      ? r.roStatusWatch
      : s === 'good'
        ? r.roStatusGood
        : r.roStatusNone;

export const modeLabel = (r: R, m: LogMode): string =>
  m === 'app' ? r.ivApp : m === 'hybrid' ? r.ivHybrid : r.ivProgram;

export const modeDescription = (r: R, m: LogMode): string =>
  m === 'app' ? r.c3LogApp : m === 'hybrid' ? r.c3LogHybrid : r.c3LogProgram;

export function levelLabels(r: R): Record<ConsentLevelId, string> {
  return r.c3Level;
}

export function sharesSummary(r: R, consent: Consent): string {
  switch (sharingSummary(consent)) {
    case 'sets+injury':
      return r.roSharesSetsInjury;
    case 'sets':
      return r.roSharesSets;
    case 'totals':
      return r.roSharesTotals;
    default:
      return r.roSharesNone;
  }
}

const READABLE: readonly Category[] = ['totals', 'sets', 'injury'];

/**
 * Exactly the categories the client has shared AND the trainer can read today (workout totals, sets and weights,
 * injuries). Body, sleep, nutrition and check-ins are never listed here: they are not readable yet, so they must
 * not be promised.
 */
export function sharedReadable(r: R, mode: LogMode, consent: Consent): string {
  const eff = effectiveConsent(mode, consent);
  const names = READABLE.filter((c) => eff[c] !== 'off').map((c) => r.c3Cat[c].label);
  return names.length ? names.join(', ') : r.roSharesNone;
}

/** The 7 consent rows of a client. A category the client has not shared never gets a value, only the lock text. */
export function consentItems(r: R, name: string, consent: Consent, mode: LogMode): ConsentItem[] {
  const first = firstName(name);
  return CATEGORIES.map((cat: Category) => {
    const level = mode === 'program' ? 'off' : consent[cat];
    return {
      id: cat,
      label: r.c3Cat[cat].label,
      level,
      levelLabel: r.c3Level[level],
      what: level === 'off' ? r.c3NotShared(first) : r.c3Cat[cat].what,
    };
  });
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

export const trainerDaysText = (r: R, days: readonly Dow[]): string =>
  days.map((d) => r.c3Dow[d]).join(', ');

/** "today" / "yesterday" / "3 days ago" / "No session yet". */
export function lastLabel(r: R, c: CoachClient, now: number): string {
  if (c.mode === 'program') return r.roNotLogged;
  if (c.lastSessionAt == null) return r.roNoSession;
  const d = Math.floor(now / DAY) - Math.floor(c.lastSessionAt / DAY);
  return d <= 0 ? r.roLastToday : d === 1 ? r.roLastYesterday : r.roLastDays(d);
}

export function ageLabel(r: R, at: number, now: number): string {
  const d = Math.max(0, Math.floor(now / DAY) - Math.floor(at / DAY));
  return d === 0 ? r.sgToday : r.sgAgeDays(d);
}

/** Relative age for the offline line: "4 minutes ago". */
export function agoText(r: R, since: number, now: number): string {
  const min = Math.max(0, Math.round((now - since) / 60_000));
  if (min < 1) return r.stAgoNow;
  if (min < 60) return r.stAgoMin(min);
  const h = Math.round(min / 60);
  if (h < 24) return r.stAgoHour(h);
  return r.stAgoDay(Math.round(h / 24));
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

/** Title of a signal. Uses facts only; the exercise / muscle names are user data and shown as they are. */
export function signalTitle(r: R, s: Signal): string {
  const f = s.facts;
  switch (s.kind) {
    case 'stall':
      return r.sgTitleStall(str(f.exercise), num(f.weeks));
    case 'machine':
      return r.sgTitleMachine;
    case 'spike':
      return r.sgTitleSpike(str(f.muscle), num(f.pct));
    case 'rhythm':
      return num(f.lowWeeks) > 0
        ? r.sgTitleRhythmLow(num(f.lowWeeks))
        : r.sgTitleRhythmIdle(num(f.idleDays));
    case 'ready':
      return r.sgTitleReady(str(f.exercise));
    case 'pr':
      return r.sgTitlePr(str(f.exercise), num(f.e1rm));
    case 'injury':
      return r.sgTitleInjury(str(f.exercise));
    case 'nodata':
      return s.reason === 'sets-not-shared' ? r.sgTitleNoSets : r.sgTitleNoData;
  }
}

export function signalBody(r: R, s: Signal): string {
  const f = s.facts;
  switch (s.kind) {
    case 'stall':
      return r.sgBodyStall(num(f.e1rm), num(f.weeks));
    case 'machine':
      return r.sgBodyMachine(str(f.exercise), num(f.from), num(f.to));
    case 'spike':
      return r.sgBodySpike(num(f.sets), num(f.chronic));
    case 'rhythm':
      return r.sgBodyRhythm(num(f.plannedThisWeek));
    case 'ready':
      return r.sgBodyReady(num(f.sessions), num(f.maxRpe));
    case 'pr':
      return r.sgBodyPr(num(f.e1rm), num(f.previous));
    case 'injury':
      return r.sgBodyInjury;
    case 'nodata':
      return s.reason === 'sets-not-shared' ? r.sgBodyNoSets : r.sgBodyNoData;
  }
}

/* ---- CSV (roster export). Only what a roster row already shows; formula-looking cells are neutralised. ---- */
const csvCell = (v: string): string => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
