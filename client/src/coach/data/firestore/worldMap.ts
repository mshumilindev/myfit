/**
 * Pure mapping from what `coachRead` / `coachClients` return (after the trainer device opened the sealed parts) to
 * the engine inputs (`ClientSignalInput`) and the roster (`CoachClient`). No I/O, no Firebase. The consent cut itself
 * is NOT done here: the server cuts by level (service.ts `gateCategory`) and the engine gates again (`gateInput`).
 */
import type { Exercise, SetEntry, Workout } from '../../../types';
import type {
  ClientSignalInput,
  LiftSeries,
  LiftSession,
  TotalsInput,
} from '../../domain/signalInputs';
import { weeksFromSessions } from '../../domain/signalInputs';
import type { ClientHistory, LiftSummary, SessionSummary, WeekCount } from '../../domain/history';
import type { ExerciseResult, SessionExercise, WorkoutEntry } from '../../domain/workouts';
import { DAY, weekStartOf } from '../../domain/time';
import type {
  Category,
  CoachClient,
  Consent,
  Level,
  LogMode,
  SharedInjury,
} from '../../domain/types';
import { CATEGORIES } from '../../domain/types';

export interface RosterClient {
  clientId: string;
  name: string;
  status: 'pending' | 'active';
  mode: LogMode;
  consent: Consent;
  consentVersion: number;
  keyEpoch: number;
  cid: string;
}
export interface RosterInvite {
  inviteId: string;
  name: string;
  mode: LogMode;
  sentAt: number;
  expiresAt: number;
}
export interface Roster {
  clients: RosterClient[];
  invites: RosterInvite[];
  serverTime: number;
}

/** One category of a `coachRead` response. */
export type ReadCategory =
  | { state: 'locked' }
  | { state: 'not-applicable' }
  | {
      state: 'ok';
      level: Exclude<Level, 'off'>;
      asOf: number;
      docs?: Record<string, unknown>[];
      view?: unknown;
      /** sealed derived view (totals `full`: the activity list), opened with the grant */
      extras?: Record<string, unknown>[];
    };

const NO_TOTALS: TotalsInput = {
  completedWeeks: [],
  plannedThisWeek: 0,
  daysSinceLast: null,
  sessionsLast4Weeks: 0,
};

/** Weekly session counts for the last completed weeks (oldest first). `planned` is unknown here and stays 0. */
export function totalsInput(startedAts: readonly number[], now: number): TotalsInput {
  if (!startedAts.length) return NO_TOTALS;
  const thisWeek = weekStartOf(now);
  const count = (from: number, to: number) => startedAts.filter((t) => t >= from && t < to).length;
  const completedWeeks = [4, 3, 2, 1].map((back) => ({
    done: count(thisWeek - back * 7 * DAY, thisWeek - (back - 1) * 7 * DAY),
    planned: 0,
  }));
  const last = Math.max(...startedAts);
  return {
    completedWeeks,
    plannedThisWeek: 0,
    daysSinceLast: Math.max(0, Math.floor((now - last) / DAY)),
    sessionsLast4Weeks: startedAts.filter((t) => t >= now - 28 * DAY).length,
  };
}

/** `totals` response -> TotalsInput. Effects arrives as weekly rows, full as one row per session. */
export function totalsFromRead(c: ReadCategory, now: number): TotalsInput | undefined {
  if (c.state !== 'ok') return undefined;
  if (c.docs) {
    return totalsInput(
      c.docs.map((d) => Number(d.startedAt)).filter((n) => Number.isFinite(n)),
      now,
    );
  }
  const v = c.view as
    | { weeks?: { weekStart: number; sessions: number }[]; lastSessionAt?: number | null }
    | undefined;
  if (!v?.weeks) return NO_TOTALS;
  const thisWeek = weekStartOf(now);
  const completedWeeks = [4, 3, 2, 1].map((back) => ({
    done: v.weeks!.find((w) => w.weekStart === thisWeek - back * 7 * DAY)?.sessions ?? 0,
    planned: 0,
  }));
  return {
    completedWeeks,
    plannedThisWeek: 0,
    daysSinceLast:
      v.lastSessionAt != null ? Math.max(0, Math.floor((now - v.lastSessionAt) / DAY)) : null,
    sessionsLast4Weeks: completedWeeks.reduce((a, w) => a + w.done, 0),
  };
}

/** Sessions started this (Monday-based) week, from a `totals` response of either level. */
export function doneThisWeek(c: ReadCategory | undefined, now: number): number {
  if (!c || c.state !== 'ok') return 0;
  const thisWeek = weekStartOf(now);
  if (c.docs) return c.docs.filter((d) => Number(d.startedAt) >= thisWeek).length;
  const v = c.view as { weeks?: { weekStart: number; sessions: number }[] } | undefined;
  return v?.weeks?.find((w) => w.weekStart === thisWeek)?.sessions ?? 0;
}

const isStrength = (e: Exercise) => (e.kind ?? 'strength') === 'strength';
const isWorking = (s: SetEntry) => !(s.isWarmup || s.type === 'warmup');
const e1rm = (kg: number, reps: number) => kg * (1 + Math.min(reps, 10) / 30);
const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-');

/** Opened workouts -> one LiftSeries per exercise name (sessions only; the engine derives the weeks). */
export function workoutsToLifts(workouts: readonly Workout[]): LiftSeries[] {
  const byLift = new Map<string, { name: string; sessions: LiftSession[] }>();
  for (const w of workouts) {
    for (const e of w.exercises ?? []) {
      if (!isStrength(e)) continue;
      const work = (e.sets ?? []).filter((s) => isWorking(s) && (s.weight ?? 0) > 0 && s.reps >= 1);
      if (!work.length) continue;
      const best = Math.max(...work.map((s) => e1rm(s.weight as number, s.reps)));
      const rpes = work.map((s) => s.rpe).filter((r): r is number => typeof r === 'number');
      const key = slug(e.name);
      const item = byLift.get(key) ?? { name: e.name, sessions: [] };
      item.sessions.push({
        at: w.startedAt,
        variant: e.equipmentItems?.[0] ?? w.gymId ?? 'unknown',
        e1rm: Math.round(best * 10) / 10,
        workingSets: work.length,
        rpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
        allRepsDone: e.plannedReps ? work.every((s) => s.reps >= (e.plannedReps as number)) : true,
        setsText: work
          .slice(0, 5)
          .map((s) => `${s.weight}x${s.reps}`)
          .join(', '),
      });
      byLift.set(key, item);
    }
  }
  return [...byLift.entries()].map(([liftId, v]) => ({
    liftId,
    name: v.name,
    sessions: v.sessions.sort((a, b) => a.at - b.at),
  }));
}

/** Effects-level lifts arrive as weekly rows only (the client device publishes them in `shares/sets`). */
export function liftsFromView(view: unknown): LiftSeries[] | undefined {
  const lifts = (view as { lifts?: LiftSeries[] } | undefined)?.lifts;
  if (!Array.isArray(lifts)) return undefined;
  return lifts
    .filter((l) => l && typeof l.liftId === 'string' && Array.isArray(l.weeks))
    .map((l) => ({ liftId: l.liftId, name: l.name, weeks: l.weeks }));
}

/** Build one client's engine input from the (opened) read results. */
export function toSignalInput(
  c: RosterClient,
  read: Partial<Record<Category, ReadCategory>>,
  opened: { workouts?: readonly Workout[]; setsView?: unknown },
  now: number,
): ClientSignalInput {
  const out: ClientSignalInput = { clientId: c.clientId, mode: c.mode, consent: c.consent };
  const t = read.totals ? totalsFromRead(read.totals, now) : undefined;
  if (t) out.totals = t;
  const sets = read.sets;
  if (sets?.state === 'ok') {
    if (sets.level === 'full' && opened.workouts) out.lifts = workoutsToLifts(opened.workouts);
    else if (sets.level === 'effects') {
      const l = liftsFromView(opened.setsView);
      if (l) out.lifts = l;
    }
  }
  return out;
}

/**
 * The Overview / Workouts / Strength record of one client, from the opened workouts (sets at `full`). Pure. Every figure is
 * derived from what the member logged: sessions, sets and tonnage of WORKING sets, and the plan comparison (sets done vs
 * the sets the plan prescribed for the exercises that had a target). `gymName` resolves a gym id when the caller knows it.
 */
export function historyFromWorkouts(
  workouts: readonly Workout[],
  now: number,
  opts: { gymName?: (gymId: string) => string | undefined } = {},
): ClientHistory {
  const done = workouts
    .filter((w) => w.finishedAt != null)
    .sort((a, b) => b.startedAt - a.startedAt);
  // a PR = a working set whose estimated 1RM beats the best of every EARLIER session for that lift (first sighting is a baseline)
  const prIds = new Set<string>();
  const bestSoFar = new Map<string, number>();
  for (const w of [...done].reverse()) {
    let hit = false;
    const todays = new Map<string, number>();
    for (const e of (w.exercises ?? []).filter(isStrength)) {
      for (const st of (e.sets ?? []).filter(isWorking)) {
        const e1 = (st.weight ?? 0) * (1 + st.reps / 30);
        todays.set(e.name, Math.max(todays.get(e.name) ?? 0, e1));
      }
    }
    for (const [name, e1] of todays) {
      const prev = bestSoFar.get(name);
      if (prev !== undefined && e1 > prev + 0.01) hit = true;
      bestSoFar.set(name, Math.max(prev ?? 0, e1));
    }
    if (hit) prIds.add(w.id);
  }
  const entries: WorkoutEntry[] = done.map((w) => {
    const strength = (w.exercises ?? []).filter(isStrength);
    const exercises: SessionExercise[] = strength.map((e) => {
      const work = (e.sets ?? []).filter(isWorking);
      return {
        name: e.name,
        sets: work.map((s) => ({
          kg: s.weight ?? 0,
          reps: s.reps,
          ...(typeof s.rpe === 'number' ? { rpe: s.rpe } : {}),
        })),
        ...(e.plannedSets
          ? { prescribed: { sets: e.plannedSets, reps: e.plannedReps ?? null } }
          : {}),
      };
    });
    const sets = exercises.reduce((n, e) => n + e.sets.length, 0);
    const tonnage = exercises.reduce(
      (n, e) => n + e.sets.reduce((m, s) => m + s.kg * s.reps, 0),
      0,
    );
    const planned = exercises.reduce((n, e) => n + (e.prescribed?.sets ?? 0), 0);
    const doneOfPlanned = exercises.reduce(
      (n, e) => n + (e.prescribed ? Math.min(e.sets.length, e.prescribed.sets) : 0),
      0,
    );
    const gym = w.gymId ? opts.gymName?.(w.gymId) : undefined;
    return {
      id: w.id,
      at: w.startedAt,
      title: w.dayName?.trim() || exercises[0]?.name || '',
      minutes: Math.max(0, Math.round(((w.finishedAt as number) - w.startedAt) / 60_000)),
      sets,
      tonnageKg: Math.round(tonnage),
      withTrainer: false,
      pr: prIds.has(w.id),
      // no plan on any exercise: nothing to compare, so it counts as complete rather than 0%
      compliance: planned > 0 ? Math.round((doneOfPlanned / planned) * 100) : 100,
      ...(gym ? { gym } : {}),
      exercises,
    };
  });
  const lifts = workoutsToLifts(done);
  /** the heaviest working set of the lift's latest session: what the member is working at now */
  const latestTop = (liftId: string): { kg: number; reps: number } => {
    for (const w of done) {
      const e = (w.exercises ?? []).find((x) => isStrength(x) && slug(x.name) === liftId);
      const work = (e?.sets ?? []).filter((x) => isWorking(x) && (x.weight ?? 0) > 0);
      if (work.length) {
        const top = work.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a));
        return { kg: top.weight ?? 0, reps: top.reps };
      }
    }
    return { kg: 0, reps: 0 };
  };
  const liftSummaries: LiftSummary[] = lifts.map((l) => {
    const sessions = l.sessions ?? [];
    return {
      id: l.liftId,
      name: l.name,
      target: latestTop(l.liftId),
      e1rm: Math.max(0, ...sessions.map((x) => x.e1rm)),
      series: sessions.slice(-8).map((x) => x.e1rm),
    };
  });
  const exerciseResults: ExerciseResult[] = lifts.map((l) => ({
    id: l.liftId,
    name: l.name,
    sessions: (l.sessions ?? []).map((x) => ({
      at: x.at,
      sets: x.workingSets,
      top: (x.setsText ?? '').split(', ')[0] ?? '',
      e1rm: x.e1rm,
      rpe: x.rpe ?? 0,
    })),
  }));
  const sessionSummaries: SessionSummary[] = entries.slice(0, 10).map((e) => ({
    id: e.id,
    at: e.at,
    title: e.title,
    sets: e.sets,
    tonnageKg: e.tonnageKg,
  }));
  const thisWeek = weekStartOf(now);
  const weeks: WeekCount[] = [6, 5, 4, 3, 2, 1].map((back) => {
    const from = thisWeek - back * 7 * DAY;
    const n = done.filter((w) => w.startedAt >= from && w.startedAt < from + 7 * DAY).length;
    return { done: n, planned: n };
  });
  return {
    lifts: liftSummaries,
    sessions: sessionSummaries,
    weeks,
    workouts: { entries, exercises: exerciseResults },
  };
}

const REASONS = ['injury', 'surgery', 'illness', 'break', 'cautious'];
const STAGES = ['protect', 'reintroduce', 'rebuild', 'return'];

/** Opened `injuries/*` documents -> the read-only list the trainer sees (healed ones last). Unknown shapes are dropped. */
export function injuriesFromDocs(docs: readonly Record<string, unknown>[]): SharedInjury[] {
  const out: SharedInjury[] = [];
  for (const d of docs) {
    if (typeof d.id !== 'string') continue;
    const reason = typeof d.reason === 'string' && REASONS.includes(d.reason) ? d.reason : 'injury';
    const side = d.side === 'left' || d.side === 'right' || d.side === 'both' ? d.side : undefined;
    const stage = typeof d.stage === 'string' && STAGES.includes(d.stage) ? d.stage : 'protect';
    const note = typeof d.note === 'string' && d.note.trim() ? d.note.trim() : undefined;
    out.push({
      id: d.id,
      reason,
      bodyPart: typeof d.bodyPart === 'string' ? d.bodyPart : '',
      ...(side ? { side } : {}),
      stage,
      startDay: Number.isFinite(Number(d.startDay)) ? Number(d.startDay) : 0,
      healed: d.healedDay != null,
      ...(note ? { note } : {}),
    });
  }
  return out.sort((a, b) => Number(a.healed) - Number(b.healed) || b.startDay - a.startDay);
}

/**
 * Consecutive weeks with at least one session, ending at this week (when it already has one) or at last week. From the
 * `totals` response of either level (one row per session at `full`, weekly rows at `effects`).
 */
export function streakFromRead(c: ReadCategory | undefined, now: number): number {
  if (!c || c.state !== 'ok') return 0;
  const counts = new Map<number, number>();
  if (c.docs) {
    for (const d of c.docs) {
      const at = Number(d.startedAt);
      if (Number.isFinite(at)) counts.set(weekStartOf(at), (counts.get(weekStartOf(at)) ?? 0) + 1);
    }
  } else {
    const v = c.view as { weeks?: { weekStart: number; sessions: number }[] } | undefined;
    for (const w of v?.weeks ?? []) counts.set(weekStartOf(w.weekStart), w.sessions);
  }
  let week = weekStartOf(now);
  if (!(counts.get(week) ?? 0)) week -= 7 * DAY; // this week has not started yet: it does not break the streak
  let n = 0;
  while ((counts.get(week) ?? 0) > 0) {
    n++;
    week -= 7 * DAY;
  }
  return n;
}

const emptyConsent = () => Object.fromEntries(CATEGORIES.map((c) => [c, 'off'])) as Consent;

/** Roster row -> the dashboard's person. Fields the server does not hold (goal, program) stay empty for the UI. */
export function toCoachClient(
  c: RosterClient,
  lastSessionAt: number | null,
  done = 0,
  extra: { streakWeeks?: number; injuries?: readonly SharedInjury[] } = {},
): CoachClient {
  return {
    id: c.clientId,
    name: c.name,
    goal: '',
    program: '',
    programWeek: 0,
    gym: '',
    mode: c.mode,
    consent: c.consent,
    streakWeeks: extra.streakWeeks ?? 0,
    planned: 0,
    done,
    lastSessionAt,
    trainerDays: [],
    hasPhoto: false,
    ...(extra.injuries ? { injuries: extra.injuries } : {}),
  };
}

export function pendingClient(i: RosterInvite): CoachClient {
  return {
    id: i.inviteId,
    name: i.name,
    goal: '',
    program: '',
    programWeek: 0,
    gym: '',
    mode: i.mode,
    consent: emptyConsent(),
    streakWeeks: 0,
    planned: 0,
    done: 0,
    lastSessionAt: null,
    trainerDays: [],
    invite: { sentAt: i.sentAt, expiresAt: i.expiresAt },
  };
}

export { weeksFromSessions };
