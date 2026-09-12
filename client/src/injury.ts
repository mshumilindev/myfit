/**
 * Injury & Rehab model (design "Injury & rehab", built on the rest/illness
 * system). An injury is NOT a passive "don't train for N months" block — that
 * deconditions and re-injures. It is a guided, phased plan driven by how it
 * feels, following return-to-sport best practice (criteria-based progression,
 * a pain traffic-light, and a graded return to load):
 *
 *   Protect → Reintroduce → Rebuild → Return
 *
 * You climb the stages by logging how a session felt (a green/amber/red
 * check-in), not by a countdown. Pure over the Injury records; the store wires
 * persistence and the UI.
 */
import type { MuscleGroup } from './data/exercises';
import type { Injury, RehabStageId, CheckinFeel, RehabReason } from './types';

/** Ordered rehab stages. */
export const REHAB_STAGES: RehabStageId[] = ['protect', 'reintroduce', 'rebuild', 'return'];

export function stageIndex(id: RehabStageId): number {
  const i = REHAB_STAGES.indexOf(id);
  return i < 0 ? 0 : i;
}

export function nextStage(id: RehabStageId): RehabStageId {
  return REHAB_STAGES[Math.min(REHAB_STAGES.length - 1, stageIndex(id) + 1)];
}

export function prevStage(id: RehabStageId): RehabStageId {
  return REHAB_STAGES[Math.max(0, stageIndex(id) - 1)];
}

/**
 * Which body part maps to which muscles to protect. A joint injury protects the
 * muscles that load it (a knee loads the quads/hamstrings/calves/adductors).
 * Order roughly by how central each muscle is to that joint.
 */
export interface BodyPart {
  id: string;
  muscles: MuscleGroup[];
}

export const BODY_PARTS: BodyPart[] = [
  { id: 'shoulder', muscles: ['shoulders', 'chest', 'triceps'] },
  { id: 'elbow', muscles: ['biceps', 'triceps', 'forearms'] },
  { id: 'wrist', muscles: ['forearms', 'biceps'] },
  { id: 'neck', muscles: ['neck', 'traps'] },
  { id: 'lower_back', muscles: ['lower_back', 'core', 'glutes'] },
  { id: 'hip', muscles: ['glutes', 'hamstrings', 'adductors', 'abductors', 'quads'] },
  { id: 'knee', muscles: ['quads', 'hamstrings', 'calves', 'adductors'] },
  { id: 'ankle', muscles: ['calves', 'quads'] },
];

export function bodyPart(id: string): BodyPart | null {
  return BODY_PARTS.find((b) => b.id === id) ?? null;
}

/** General / non-muscle branch reasons (skip muscle picking). */
export const GENERAL_REASONS: RehabReason[] = ['surgery', 'illness', 'break', 'cautious'];

/** True while a clinician no-load window (Stage 0 · Full rest) is still running. */
export function inFullRest(inj: Injury, today: number): boolean {
  return inj.fullRestUntil != null && today < inj.fullRestUntil;
}

/** The setup answer "how does it feel now" seeds the starting stage. */
export function feelToStage(feel: 'cant' | 'sore' | 'almost'): RehabStageId {
  return feel === 'cant' ? 'protect' : feel === 'sore' ? 'reintroduce' : 'rebuild';
}

/** Two good ("fine") sessions in a row in the current stage advance you. */
export const ADVANCE_STREAK = 2;

/**
 * How much load a protected muscle may take at each stage (fraction of normal):
 * Protect = out entirely, Reintroduce = light, Rebuild = graded, Return = full.
 */
export function loadFactor(stage: RehabStageId): number {
  switch (stage) {
    case 'protect':
      return 0;
    case 'reintroduce':
      return 0.5;
    case 'rebuild':
      return 0.75;
    default:
      return 1;
  }
}

/** The graded weight ramp shown in the Rebuild stage (fractions of old load). */
export const REBUILD_RAMP = [0.6, 0.75, 0.9, 1];

/** Trailing consecutive "fine" check-ins logged while in the current stage. */
export function consecutiveFine(inj: Injury): number {
  let n = 0;
  for (let i = inj.checkins.length - 1; i >= 0; i--) {
    const c = inj.checkins[i];
    if (c.stage !== inj.stage) break;
    if (c.feel === 'fine') n++;
    else break;
  }
  return n;
}

export interface CheckinResult {
  /** Target stage: the next stage on 'ready', the previous on 'regress', the
   *  current on 'hold'. */
  stage: RehabStageId;
  /** 'ready' = two good sessions in a row; the next stage is OFFERED (the user
   *  confirms — never automatic). 'hold' = stay. 'regress' = ease back a stage. */
  outcome: 'ready' | 'hold' | 'regress';
}

/**
 * Apply a check-in and return what it means (pure — the store then commits it):
 *  - pain  → ease back a stage (regress); never push through pain
 *  - sore  → hold at this stage
 *  - fine  → once ADVANCE_STREAK good sessions in a row, OFFER the next stage
 *            ('ready'); the user confirms, it never advances on its own.
 */
export function applyCheckin(inj: Injury, feel: CheckinFeel): CheckinResult {
  if (feel === 'pain') {
    const stage = prevStage(inj.stage);
    return { stage, outcome: stage === inj.stage ? 'hold' : 'regress' };
  }
  if (feel === 'sore') return { stage: inj.stage, outcome: 'hold' };
  // fine — count this one plus the trailing streak already in this stage.
  const streak = consecutiveFine(inj) + 1;
  const next = nextStage(inj.stage);
  if (streak >= ADVANCE_STREAK && next !== inj.stage) {
    return { stage: next, outcome: 'ready' };
  }
  return { stage: inj.stage, outcome: 'hold' };
}

/** Active (not yet healed) injuries. */
export function activeInjuries(injuries: Injury[]): Injury[] {
  return injuries.filter((i) => i.healedDay == null);
}

/** Muscles fully out of training right now (any active injury in Protect). */
export function protectedMuscles(injuries: Injury[]): Set<MuscleGroup> {
  const out = new Set<MuscleGroup>();
  for (const inj of activeInjuries(injuries)) {
    if (inj.stage === 'protect') for (const m of inj.muscles) out.add(m);
  }
  return out;
}

/**
 * Muscles under a rehab load cap (Reintroduce/Rebuild) → the smallest factor
 * across active injuries touching them. Protected muscles are 0 here too.
 */
export function loadCaps(injuries: Injury[]): Map<MuscleGroup, number> {
  const caps = new Map<MuscleGroup, number>();
  for (const inj of activeInjuries(injuries)) {
    if (inj.stage === 'return') continue;
    const f = loadFactor(inj.stage);
    for (const m of inj.muscles) {
      const prev = caps.get(m);
      caps.set(m, prev == null ? f : Math.min(prev, f));
    }
  }
  return caps;
}
