/**
 * The seam between the core and Periodization (SPO-609, Advanced training). The core keeps no cycle or percent rules: every
 * calculation lives in the lazy chunk `periodization/` and arrives through `periodizationHost` when the chunk loads
 * (`periodization/periodizationBoot.ts`). Each function here asks the chunk only while the module is installed AND loaded;
 * otherwise it answers the neutral value (the program's own week, kilograms only, one rep number) and passes stored data
 * through untouched. So with the module off nothing of it counts or shows, and no caller needs its own `if`.
 * Imports stay light on purpose (types and the gate), so core data modules can use this file.
 */
import type { ComponentType } from 'react';
import { periodizationAvailable } from './addons/featureGates';
import type { LocaleId } from './i18n';
import type { MoreMenuItem } from './components/ui/MoreMenu';
import type { ProgramCycle, ProgramItem, WeekPlan } from './views/programs/model';
import type { MuscleGroup } from './data/exercises';
import type { Exercise } from './types';
import type { ExportFile } from './legal/export/exportTypes';
import type { EditorSlots, ProgramEditorHost } from './tools/programEditor/host';

/** The least a program must have for a cycle to apply to it. */
export interface WeekSource {
  items: ProgramItem[];
  dayNames?: Record<string, string>;
  targetMuscles?: Record<string, MuscleGroup[]>;
  cycle?: ProgramCycle;
}

export interface Load {
  /** Kilograms to put on the bar, null when none is prescribed or a percent has no max yet. */
  kg: number | null;
  /** The prescribed percent, when the row asks for one. */
  pct: number | null;
  /** A percent is prescribed but there is no max to turn it into kilograms ("no max yet"). */
  needsMax: boolean;
}

type Base = Pick<WeekPlan, 'items' | 'dayNames' | 'targetMuscles'>;
type RowExtras = Pick<ProgramItem, 'targetPct' | 'repsMin'>;

export interface PeriodizationHost {
  /** The Maxes page (an overlay of Gym). */
  MaxesPage: ComponentType<{ onClose: () => void }> | null;
  /** The one plain row in More. */
  moreItem: ((locale: LocaleId, open: () => void) => MoreMenuItem) | null;
  /** The typed maxes, decrypted on this device, for the data export. */
  exportFiles: (() => ExportFile[]) | null;
  /** The person's max for an exercise in kg (typed, else the estimate from history); null when there is none. */
  maxFor: ((exerciseName: string) => number | null) | null;
  /** The days of program week `week` (the cycle week it falls on). */
  weekPlan: ((p: WeekSource, week: number) => WeekPlan) | null;
  /** Clean a stored cycle to match its base week (length, weeks, labels). */
  sanitizeCycle: ((raw: unknown, base: Base) => ProgramCycle | undefined) | null;
  /** A copy of a cycle with fresh row ids (for duplicating a program). */
  cloneCycle: ((c: ProgramCycle) => ProgramCycle) | null;
  /** The percent and rep range a row keeps when saved. */
  rowExtras: ((i: ProgramItem) => RowExtras) | null;
  /** The load a row asks for, given the person's max. */
  load: ((i: Pick<ProgramItem, 'targetWeight' | 'targetPct'>, max: number | null) => Load) | null;
  /** The lower end of a rep range, or null when the row has none. */
  repsMin: ((i: Pick<ProgramItem, 'reps' | 'repsMin'>) => number | null) | null;
  /** The line under an exercise in a live session: the percent, the kilograms, the rep range. */
  TargetLine: ComponentType<{ exercise: Exercise }> | null;
  /** "6–8" or the plain rep count. */
  repsLabel: ((i: Pick<ProgramItem, 'reps' | 'repsMin'>) => string) | null;
  /** Where the person is in the cycle, as a line ("Cycle week 3 of 4 · Deload"), or null. */
  cycleNote: ((p: WeekSource, week: number, locale: LocaleId) => string | null) | null;
  /** "Start in cycle week N" for the assign sheet. */
  StartWeekField: ComponentType<{
    length: number;
    value: number;
    onChange: (n: number) => void;
  }> | null;
  /** The pre-send check of the other cycle weeks: `checkRules` and `describeFinding` of the editor host. */
  editorCheck: Pick<ProgramEditorHost, 'checkRules' | 'describeFinding'> | null;
  /** What the program editor gets: the cycle wrapper and bar, the % of max and rep-range fields of a row. */
  editorSlots: Pick<EditorSlots, 'wrap' | 'weekBar' | 'rowLoad' | 'rowReps'> | null;
}

export const periodizationHost: PeriodizationHost = {
  MaxesPage: null,
  moreItem: null,
  exportFiles: null,
  maxFor: null,
  weekPlan: null,
  sanitizeCycle: null,
  cloneCycle: null,
  rowExtras: null,
  load: null,
  repsMin: null,
  TargetLine: null,
  repsLabel: null,
  cycleNote: null,
  StartWeekField: null,
  editorCheck: null,
  editorSlots: null,
};

/** True when the module is installed and its chunk has filled the host. */
const live = (): boolean => periodizationAvailable() && periodizationHost.weekPlan !== null;

/** The days to train in program week `week`: the cycle week when the module is live, else the program's own week. */
export function weekPlanFor(p: WeekSource, week: number): WeekPlan {
  if (p.cycle && live() && periodizationHost.weekPlan) return periodizationHost.weekPlan(p, week);
  return { dayNames: p.dayNames ?? {}, targetMuscles: p.targetMuscles ?? {}, items: p.items };
}

/** A stored cycle made clean (module live) or passed through untouched (module off: its data is never changed). */
export function sanitizeCycleFor(raw: unknown, base: Base): ProgramCycle | undefined {
  if (periodizationAvailable() && periodizationHost.sanitizeCycle)
    return periodizationHost.sanitizeCycle(raw, base);
  return raw && typeof raw === 'object' ? (raw as ProgramCycle) : undefined;
}

/** A cycle copied for a duplicated program: fresh ids when the module is live, else a plain copy of the stored data. */
export function cloneCycleFor(c: ProgramCycle): ProgramCycle {
  if (periodizationHost.cloneCycle) return periodizationHost.cloneCycle(c);
  return JSON.parse(JSON.stringify(c)) as ProgramCycle;
}

/** The percent and rep range of a row to keep when saving: cleaned when the module is live, else carried over as stored. */
export function rowExtrasFor(i: ProgramItem): RowExtras {
  if (periodizationAvailable() && periodizationHost.rowExtras)
    return periodizationHost.rowExtras(i);
  return {
    ...(typeof i.targetPct === 'number' ? { targetPct: i.targetPct } : {}),
    ...(typeof i.repsMin === 'number' ? { repsMin: i.repsMin } : {}),
  };
}

/** The load a row asks for. Module off: kilograms only, never a percent. */
export function loadFor(
  i: Pick<ProgramItem, 'targetWeight' | 'targetPct'>,
  max: number | null,
): Load {
  if (live() && periodizationHost.load) return periodizationHost.load(i, max);
  return { kg: i.targetWeight ?? null, pct: null, needsMax: false };
}

/** The reps of a row as text; a range only while the module is live. */
export function repsLabelFor(i: Pick<ProgramItem, 'reps' | 'repsMin'>): string {
  if (live() && periodizationHost.repsLabel) return periodizationHost.repsLabel(i);
  return String(i.reps);
}

/** The lower end of a row's rep range; null while the module is off or the row has no range. */
export function repsMinFor(i: Pick<ProgramItem, 'reps' | 'repsMin'>): number | null {
  return live() && periodizationHost.repsMin ? periodizationHost.repsMin(i) : null;
}

/** The person's max for an exercise, or null: always null while the module is off or its chunk has not loaded. */
export function maxForExercise(name: string): number | null {
  return live() ? (periodizationHost.maxFor?.(name) ?? null) : null;
}

/** The person's place in the program's cycle as a line; null while the module is off, not loaded or there is no cycle. */
export function cycleNoteFor(p: WeekSource, week: number, locale: LocaleId): string | null {
  return live() && p.cycle && periodizationHost.cycleNote
    ? periodizationHost.cycleNote(p, week, locale)
    : null;
}
