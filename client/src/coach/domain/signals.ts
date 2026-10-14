/**
 * Signal engine (plan 8.2). Pure: no I/O, no clock (`now` is a parameter), no copy.
 * `detectSignals(inputs, now)` gates every input by consent first, so a locked category cannot
 * produce a signal or an evidence row. Health data (sleep, body, nutrition) never triggers an alert;
 * `injury` is raised only from a PROGRAM CONFLICT.
 */
import { atLeast } from './consent';
import {
  gateInput,
  weeksFromSessions,
  type ClientSignalInput,
  type LiftSeries,
  type LiftWeek,
} from './signalInputs';
import {
  EVIDENCE_MAX_ROWS,
  HYBRID_MIN_SESSIONS_4W,
  NOISE_KG,
  PR_MIN_HISTORY_WEEKS,
  READY_MAX_RPE,
  READY_SESSIONS,
  RHYTHM_IDLE_DAYS,
  RHYTHM_MIN_SHARE,
  RHYTHM_WEEKS,
  SPIKE_CHRONIC_WEEKS,
  SPIKE_MIN_CHRONIC_SETS,
  SPIKE_RATIO,
  STALL_VOLUME_TOLERANCE,
  STALL_WEEKS,
} from './signalConfig';
import { mean, weekStartOf } from './time';
import type { Confidence, Evidence, EvidenceRow, Severity, Signal, SignalKind } from './types';

export const signalKey = (clientId: string, kind: SignalKind, exerciseKey: string | null = null) =>
  `${clientId}|${kind}|${exerciseKey ?? ''}`;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Completed weeks (before the current one) and the current partial week of a lift. */
function splitWeeks(weeks: readonly LiftWeek[], now: number) {
  const cur = weekStartOf(now);
  const sorted = [...weeks].sort((a, b) => a.weekStart - b.weekStart);
  return {
    completed: sorted.filter((w) => w.weekStart < cur),
    current: sorted.find((w) => w.weekStart === cur) ?? null,
  };
}

const weekRow = (w: LiftWeek, label: string): EvidenceRow => ({
  at: w.weekStart,
  label,
  value: w.bestE1rm,
  unit: 'kg',
  detail: `${w.workingSets} sets`,
});

function liftEvidence(lift: LiftSeries, weeks: LiftWeek[], granular: boolean): Evidence {
  const rows: EvidenceRow[] =
    granular && lift.sessions?.length
      ? [...lift.sessions]
          .sort((a, b) => b.at - a.at)
          .slice(0, EVIDENCE_MAX_ROWS)
          .map((s) => ({
            at: s.at,
            label: lift.name,
            value: s.e1rm,
            unit: 'kg' as const,
            detail: s.setsText,
          }))
      : weeks
          .slice(-EVIDENCE_MAX_ROWS)
          .reverse()
          .map((w) => weekRow(w, lift.name));
  return {
    category: 'sets',
    level: granular && lift.sessions?.length ? 'full' : 'effects',
    granular: !!(granular && lift.sessions?.length),
    rows,
  };
}

const confidenceOf = (variant: string, granular: boolean, weeksN: number): Confidence =>
  variant === 'unknown' ? 'low' : granular && weeksN >= STALL_WEEKS ? 'high' : 'medium';

/* ---- stall / machine -------------------------------------------------------------------------------------- */
function detectLift(
  clientId: string,
  lift: LiftSeries,
  now: number,
  setsFull: boolean,
  hybridGate: boolean,
): Signal[] {
  const weeks = lift.weeks ?? (lift.sessions ? weeksFromSessions(lift.sessions) : []);
  const { completed, current } = splitWeeks(weeks, now);
  const out: Signal[] = [];
  const granular = setsFull;

  // ---- stall / machine (needs STALL_WEEKS completed weeks) ----
  if (!hybridGate && completed.length >= STALL_WEEKS) {
    const win = completed.slice(-STALL_WEEKS);
    const withCur = current ? [...win, current] : win;
    const variants = new Set(withCur.map((w) => w.variant));
    const base = win[0].bestE1rm;
    const best = Math.max(...withCur.slice(1).map((w) => w.bestE1rm));
    const progress = best - base;
    const sets = win.map((w) => w.workingSets);
    const m = mean(sets);
    const steady = m > 0 && sets.every((s) => Math.abs(s - m) <= m * STALL_VOLUME_TOLERANCE);
    if (progress < NOISE_KG && steady) {
      if (variants.size > 1) {
        // A machine/gym change turns a would-be stall into `machine`, never a stall.
        const key = signalKey(clientId, 'machine', lift.liftId);
        out.push({
          key,
          clientId,
          kind: 'machine',
          severity: 'watch',
          confidence: 'medium',
          strength: 40,
          exerciseKey: lift.liftId,
          detectedAt: now,
          facts: {
            exercise: lift.name,
            from: base,
            to: withCur[withCur.length - 1].bestE1rm,
            variantFrom: win[0].variant,
            variantTo: withCur[withCur.length - 1].variant,
          },
          evidence: [liftEvidence(lift, withCur, granular)],
        });
      } else {
        let flat = STALL_WEEKS;
        for (let k = STALL_WEEKS + 1; k <= completed.length; k++) {
          const w = completed.slice(-k);
          if (
            Math.max(...w.slice(1).map((x) => x.bestE1rm), ...(current ? [current.bestE1rm] : [])) -
              w[0].bestE1rm <
            NOISE_KG
          )
            flat = k;
          else break;
        }
        const key = signalKey(clientId, 'stall', lift.liftId);
        out.push({
          key,
          clientId,
          kind: 'stall',
          severity: 'urgent',
          confidence: confidenceOf(win[0].variant, granular, win.length),
          strength: clamp(20 + 10 * flat),
          exerciseKey: lift.liftId,
          detectedAt: now,
          facts: {
            exercise: lift.name,
            e1rm: withCur[withCur.length - 1].bestE1rm,
            weeks: flat,
            gainKg: Math.round(progress * 10) / 10,
            variant: win[0].variant,
          },
          evidence: [liftEvidence(lift, withCur, granular)],
        });
      }
    }
  }

  // ---- pr (weekly best above everything before; informational) ----
  const series = current ? [...completed, current] : completed;
  if (series.length > PR_MIN_HISTORY_WEEKS) {
    const last = series[series.length - 1];
    const before = series.slice(0, -1);
    const prev = Math.max(...before.map((w) => w.bestE1rm));
    const recent = last.weekStart >= weekStartOf(now) - 7 * 86_400_000;
    if (recent && last.bestE1rm > prev && last.bestE1rm - prev >= 0.5) {
      out.push({
        key: signalKey(clientId, 'pr', lift.liftId),
        clientId,
        kind: 'pr',
        severity: 'good',
        confidence: 'high',
        strength: 30,
        exerciseKey: lift.liftId,
        detectedAt: now,
        facts: {
          exercise: lift.name,
          e1rm: last.bestE1rm,
          previous: prev,
          gainKg: Math.round((last.bestE1rm - prev) * 10) / 10,
        },
        evidence: [liftEvidence(lift, series, granular)],
      });
    }
  }

  // ---- ready (needs set-by-set rows: Full only) ----
  if (setsFull && lift.sessions && lift.sessions.length >= READY_SESSIONS) {
    const last = [...lift.sessions].sort((a, b) => a.at - b.at).slice(-READY_SESSIONS);
    const sameVariant = new Set(last.map((s) => s.variant)).size === 1;
    if (
      sameVariant &&
      last.every((s) => s.rpe != null && s.rpe <= READY_MAX_RPE && s.allRepsDone)
    ) {
      out.push({
        key: signalKey(clientId, 'ready', lift.liftId),
        clientId,
        kind: 'ready',
        severity: 'good',
        confidence: 'high',
        strength: 30,
        exerciseKey: lift.liftId,
        detectedAt: now,
        facts: {
          exercise: lift.name,
          sessions: READY_SESSIONS,
          maxRpe: Math.max(...last.map((s) => s.rpe ?? 0)),
          stepKg: 2.5,
        },
        evidence: [liftEvidence(lift, weeks, true)],
      });
    }
  }
  return out;
}

/* ---- per client ---------------------------------------------------------------------------------------------- */
function detectClient(raw: ClientSignalInput, now: number): Signal[] {
  const inp = gateInput(raw, now);
  if (inp.mode === 'program') return [];
  const out: Signal[] = [];
  const { consent, clientId } = inp;
  const hybrid = inp.mode === 'hybrid';
  const sessions4w = inp.totals?.sessionsLast4Weeks ?? null;
  // hybrid: rhythm and stall only when data exists in the last 4 weeks, else a `nodata` card.
  const hybridNoData =
    hybrid &&
    (consent.totals !== 'off' || consent.sets !== 'off') &&
    (sessions4w ?? 0) < HYBRID_MIN_SESSIONS_4W &&
    !inp.lifts?.some((l) => (l.weeks?.length ?? 0) > 0);

  if (hybridNoData) {
    out.push({
      key: signalKey(clientId, 'nodata'),
      clientId,
      kind: 'nodata',
      severity: 'watch',
      confidence: 'low',
      strength: 10,
      exerciseKey: null,
      detectedAt: now,
      facts: {},
      evidence: [],
      reason: 'no-data',
    });
  } else if (consent.totals !== 'off' && consent.sets === 'off') {
    out.push({
      key: signalKey(clientId, 'nodata'),
      clientId,
      kind: 'nodata',
      // informational: the trainer chose to see totals only, nothing is wrong
      severity: 'good',
      confidence: 'low',
      strength: 10,
      exerciseKey: null,
      detectedAt: now,
      facts: { rhythmDone: inp.totals?.completedWeeks.at(-1)?.done ?? null },
      evidence: [],
      reason: 'sets-not-shared',
    });
  }

  // rhythm (totals effects/full)
  if (!hybridNoData && inp.totals && atLeast(consent.totals, 'effects')) {
    const t = inp.totals;
    const last = t.completedWeeks.slice(-RHYTHM_WEEKS);
    const low =
      last.length === RHYTHM_WEEKS &&
      last.every((w) => w.planned > 0 && w.done < w.planned * RHYTHM_MIN_SHARE);
    const idle =
      t.plannedThisWeek > 0 && t.daysSinceLast != null && t.daysSinceLast > RHYTHM_IDLE_DAYS;
    if (low || idle) {
      const idleDays = t.daysSinceLast ?? 0;
      const severity: Severity = (low && idle) || idleDays >= 14 ? 'urgent' : 'watch';
      const rows: EvidenceRow[] = t.completedWeeks.slice(-EVIDENCE_MAX_ROWS).map((w, i, a) => ({
        at: null,
        label: `week-${a.length - i}`,
        value: w.done,
        unit: 'sessions' as const,
        detail: `planned ${w.planned}`,
      }));
      out.push({
        key: signalKey(clientId, 'rhythm'),
        clientId,
        kind: 'rhythm',
        severity,
        confidence: 'high',
        strength: clamp(Math.max(idleDays * 5, low ? 50 : 0)),
        exerciseKey: null,
        detectedAt: now,
        facts: {
          idleDays: t.daysSinceLast,
          lowWeeks: low ? RHYTHM_WEEKS : 0,
          plannedThisWeek: t.plannedThisWeek,
        },
        evidence: [
          {
            category: 'totals',
            level: consent.totals === 'full' ? 'full' : 'effects',
            granular: consent.totals === 'full',
            rows,
          },
        ],
      });
    }
  }

  // lifts: stall / machine / pr / ready (sets effects/full)
  if (inp.lifts && atLeast(consent.sets, 'effects')) {
    for (const l of inp.lifts)
      out.push(...detectLift(clientId, l, now, consent.sets === 'full', hybridNoData));
  }

  // spike (sets effects/full)
  if (inp.muscles && atLeast(consent.sets, 'effects')) {
    for (const m of inp.muscles) {
      const cur = m.weeklySets[m.weeklySets.length - 1];
      const prior = m.weeklySets.slice(-1 - SPIKE_CHRONIC_WEEKS, -1);
      if (prior.length < SPIKE_CHRONIC_WEEKS || cur == null) continue;
      const chronic = mean(prior);
      if (chronic < SPIKE_MIN_CHRONIC_SETS) continue;
      const ratio = cur / chronic;
      if (ratio > SPIKE_RATIO) {
        out.push({
          key: signalKey(clientId, 'spike', m.muscle),
          clientId,
          kind: 'spike',
          severity: ratio >= 1.6 ? 'urgent' : 'watch',
          confidence: 'medium',
          strength: clamp((ratio - 1) * 150),
          exerciseKey: m.muscle,
          detectedAt: now,
          facts: {
            muscle: m.muscle,
            sets: cur,
            chronic: Math.round(chronic * 10) / 10,
            pct: Math.round((ratio - 1) * 100),
          },
          evidence: [
            {
              category: 'sets',
              level: consent.sets === 'full' ? 'full' : 'effects',
              granular: false,
              rows: m.weeklySets.slice(-EVIDENCE_MAX_ROWS).map((v, i, a) => ({
                at: null,
                label: m.muscle,
                value: v,
                unit: 'sets' as const,
                detail: `week-${a.length - 1 - i}`,
              })),
            },
          ],
        });
      }
    }
  }

  // injury: only from a program conflict; needs sets and injury both readable
  if (
    inp.injury &&
    atLeast(consent.injury, 'effects') &&
    consent.sets !== 'off' &&
    inp.injury.conflicts.length
  ) {
    const c = inp.injury.conflicts[0];
    out.push({
      key: signalKey(clientId, 'injury', c.exercise),
      clientId,
      kind: 'injury',
      severity: 'urgent',
      confidence: 'high',
      strength: clamp(60 + 10 * inp.injury.conflicts.length),
      exerciseKey: c.exercise,
      detectedAt: now,
      facts: {
        exercise: c.exercise,
        restriction: consent.injury === 'full' ? c.restriction : null,
        conflicts: inp.injury.conflicts.length,
      },
      evidence: [
        {
          category: 'injury',
          level: consent.injury === 'full' ? 'full' : 'effects',
          granular: consent.injury === 'full',
          rows: inp.injury.conflicts.slice(0, EVIDENCE_MAX_ROWS).map((x) => ({
            at: null,
            label: x.exercise,
            value: 0,
            unit: 'sets' as const,
            detail: consent.injury === 'full' ? x.restriction : undefined,
          })),
        },
      ],
    });
  }
  return out;
}

const SEV: Record<Severity, number> = { urgent: 0, watch: 1, good: 2 };
const KIND: Record<SignalKind, number> = {
  stall: 0,
  injury: 1,
  rhythm: 2,
  machine: 3,
  spike: 4,
  nodata: 5,
  ready: 6,
  pr: 7,
};

/** Ranking: severity, then kind, then strength (high first), then client id for determinism. No score, no gamification. */
export function rankSignals(signals: readonly Signal[]): Signal[] {
  return [...signals].sort(
    (a, b) =>
      SEV[a.severity] - SEV[b.severity] ||
      KIND[a.kind] - KIND[b.kind] ||
      b.strength - a.strength ||
      a.key.localeCompare(b.key),
  );
}

export function detectSignals(inputs: readonly ClientSignalInput[], now: number): Signal[] {
  return rankSignals(inputs.flatMap((i) => detectClient(i, now)));
}
