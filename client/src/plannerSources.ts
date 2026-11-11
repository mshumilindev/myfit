/**
 * "Based on" sources for Planner. Any add-on offers its things to the Planner form by dropping ONE file into
 * `plannerSources/` that calls `registerPlannerSource` (the folder is picked up by Planner itself, `planner/plannerBoot.ts`),
 * so a new add-on appears in Planner's "Based on" without touching Planner. A source draws its own group (kit
 * `GroupedList surface="raised"`) and decides for itself when to show: it returns null while its add-on is not installed.
 */
import type { ComponentType } from 'react';

/** The colours of a plan (the colour drawer of the form). */
export type PlannerColor =
  | 'accent'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'gray';

/** What choosing a row puts into the new plan. */
export interface PlannerPick {
  /** Stable id of the thing (marks the chosen row with a check). */
  id: string;
  /** Plan title. */
  title: string;
  /** Kit icon name. */
  icon: string;
  /** Plan colour that goes with the thing (an activity's family, a program day, a home set). */
  color?: PlannerColor;
  /** Short line shown in the form's "Based on" row (usually the source name). */
  sub: string;
}

export interface PlannerSourceProps {
  /** Id of the pick the form is based on now (null: own plan). */
  selectedId: string | null;
  onPick: (pick: PlannerPick) => void;
  /** Weekdays the plan lands on, 1 = Monday … 7 = Sunday (a source about days, like a program, shows only those). */
  weekdays: number[];
  /** Opens this source's full list (`All`), when it has one. */
  onAll: () => void;
}

export interface PlannerAllProps {
  /** What the person typed in the search field above the full list (empty: everything). */
  query: string;
  selectedId: string | null;
  onPick: (pick: PlannerPick) => void;
}

export interface PlannerSource {
  id: string;
  /** Groups are listed by ascending order. */
  order: number;
  /** The few rows shown in the picker (draw a `GroupedList surface="raised"`; null when the add-on is off or empty). */
  Group: ComponentType<PlannerSourceProps>;
  /** The full list behind an "All …" row, with search. */
  All?: ComponentType<PlannerAllProps>;
  /** Title of the full list. */
  allTitle?: () => string;
}

const sources = new Map<string, PlannerSource>();

export function registerPlannerSource(s: PlannerSource): void {
  sources.set(s.id, s);
}

export function plannerSources(): PlannerSource[] {
  return [...sources.values()].sort((a, b) => a.order - b.order);
}
