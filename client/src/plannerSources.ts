/**
 * "Based on" sources for Planner. Any add-on offers its things to the Planner form by dropping ONE file into
 * `plannerSources/` that calls `registerPlannerSource` (the folder is picked up by Planner itself, `planner/plannerBoot.ts`),
 * so a new add-on appears in Planner's "Based on" without touching Planner. A source draws its own group (kit
 * `GroupedList surface="raised"`) and decides for itself when to show: it returns null while its add-on is not installed.
 */
import type { ComponentType } from 'react';

/** What choosing a row puts into the new plan. */
export interface PlannerPick {
  /** Plan title. */
  title: string;
  /** Kit icon name. */
  icon: string;
  /** Short line shown in the form's "Based on" row (usually the source name). */
  sub: string;
}

export interface PlannerSourceProps {
  /** What the person typed in the picker's search field (empty: everything). */
  query: string;
  onPick: (pick: PlannerPick) => void;
}

export interface PlannerSource {
  id: string;
  /** Groups are listed by ascending order. */
  order: number;
  /** True when the picker should offer a search field for this source. */
  searchable?: boolean;
  Group: ComponentType<PlannerSourceProps>;
}

const sources = new Map<string, PlannerSource>();

export function registerPlannerSource(s: PlannerSource): void {
  sources.set(s.id, s);
}

export function plannerSources(): PlannerSource[] {
  return [...sources.values()].sort((a, b) => a.order - b.order);
}
