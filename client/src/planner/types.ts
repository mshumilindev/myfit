import type { PlanTiming } from './recurrence';

/** Where a plan's title and icon came from. It only fills the form; nothing is logged to history (SPO-552). */
export type PlanSource =
  | { kind: 'program'; ref: string }
  | { kind: 'home'; ref: string }
  | { kind: 'activity'; ref: string };

export type PlanMode = 'quiet' | 'ring';

/** One plan. Everything but `id`, `mode`, `nextFireAt`, `enabled`, `v`, `updatedAt` is sealed in the vault (encryptedDoc OPEN_FIELDS). */
export interface PlanDoc extends Record<string, unknown> {
  id: string;
  title: string;
  note?: string;
  icon: string;
  color: string;
  source?: PlanSource;
  timing: PlanTiming;
  durationMin?: number;
  mode: PlanMode;
  /** A persistent reminder normally ignores quiet hours; this switch makes it respect them. */
  respectQuiet: boolean;
  enabled: boolean;
  /** Open: UTC ms of the next reminder, or null when the plan is over. The only time the server learns. */
  nextFireAt: number | null;
  v: 1;
  updatedAt: number;
}

/** Weekly free hours: day 0 = Monday … 6 = Sunday, ranges of whole hours [from, to). */
export type WeeklyHours = Record<number, [number, number][]>;

export interface PlannerPrefs extends Record<string, unknown> {
  updatedAt: number;
  availability: WeeklyHours;
  /** Share free/busy with the trainer (only takes effect after the client allowed it; I10). */
  shareAvailability: boolean;
  defaults: { lead: number; mode: PlanMode; durationMin: number };
}
