import { DEFAULT_LEAD, nextFire, type Ends, type PlanTiming, type Repeat } from './recurrence';
import type { PlanDoc, PlanMode } from './types';
import { weekday, type DayKey } from './zoned';

export type RepeatKind = 'none' | 'daily' | 'weekly' | 'weekdays' | 'biweekly' | 'monthly';

/** What the form edits. Turned into a PlanDoc by `draftToPlan`. */
export interface Draft {
  id: string;
  title: string;
  color: PTone;
  icon: string;
  start: DayKey;
  hour: number;
  minute: number;
  repeat: RepeatKind;
  /** Weekly / every 2 weeks: 0 = Monday … 6 = Sunday. */
  days: number[];
  ends: Ends;
  durationMin: number;
  mode: PlanMode;
  lead: number;
}

export type PTone =
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
export const PTONES: PTone[] = [
  'accent',
  'red',
  'orange',
  'yellow',
  'lime',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
  'gray',
];
export const REPEAT_KINDS: RepeatKind[] = [
  'none',
  'daily',
  'weekly',
  'weekdays',
  'biweekly',
  'monthly',
];

export function repeatOf(kind: RepeatKind, start: DayKey, days?: number[]): Repeat {
  const d = days && days.length ? [...days].sort() : [weekday(start)];
  switch (kind) {
    case 'none':
      return { kind: 'none' };
    case 'daily':
      return { kind: 'daily', every: 1 };
    case 'weekly':
      return { kind: 'weekly', every: 1, days: d };
    case 'weekdays':
      return { kind: 'weekly', every: 1, days: [0, 1, 2, 3, 4] };
    case 'biweekly':
      return { kind: 'weekly', every: 2, days: d };
    case 'monthly':
      return { kind: 'monthly', every: 1 };
  }
}

/** The form kind of a stored repeat. */
export function kindOf(r: Repeat): RepeatKind {
  if (r.kind === 'none') return 'none';
  if (r.kind === 'daily') return 'daily';
  if (r.kind === 'monthly') return 'monthly';
  if (r.every === 2) return 'biweekly';
  return r.days.length === 5 && r.days.every((d) => d < 5) ? 'weekdays' : 'weekly';
}

const hm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

export function draftToPlan(
  d: Draft,
  tz: string,
  prev: PlanDoc | undefined,
  now = Date.now(),
): PlanDoc {
  const timing: PlanTiming = {
    tz,
    start: d.start,
    time: hm(d.hour, d.minute),
    lead: d.lead,
    repeat: repeatOf(d.repeat, d.start, d.days),
    ends: d.repeat === 'none' ? { kind: 'never' } : d.ends,
    skip: prev?.timing.skip ?? [],
  };
  return {
    ...(prev ?? {}),
    id: d.id,
    title: d.title.trim(),
    icon: d.icon,
    color: d.color,
    timing,
    durationMin: d.durationMin,
    mode: d.mode,
    respectQuiet: prev?.respectQuiet ?? false,
    enabled: true,
    nextFireAt: nextFire(timing, now)?.fireAt ?? null,
    v: 1,
    updatedAt: now,
  };
}

export function planToDraft(p: PlanDoc): Draft {
  const [h, m] = p.timing.time.split(':').map(Number);
  const r = p.timing.repeat;
  return {
    id: p.id,
    title: p.title,
    color: (PTONES as string[]).includes(p.color) ? (p.color as PTone) : 'accent',
    icon: p.icon,
    start: p.timing.start,
    hour: h ?? 9,
    minute: m ?? 0,
    repeat: kindOf(r),
    days: r.kind === 'weekly' ? r.days : [weekday(p.timing.start)],
    ends: p.timing.ends,
    durationMin: p.durationMin ?? 60,
    mode: p.mode,
    lead: p.timing.lead,
  };
}

/** A new plan, starting from the person's Planner defaults (Settings: Remind me, Duration, Reminder style) when given. */
export const newDraft = (
  id: string,
  day: DayKey,
  defaults?: { lead: number; mode: PlanMode; durationMin: number },
): Draft => ({
  id,
  title: '',
  color: 'accent',
  icon: 'calendar-dots',
  start: day,
  hour: 18,
  minute: 0,
  repeat: 'none',
  days: [weekday(day)],
  ends: { kind: 'never' },
  durationMin: defaults?.durationMin ?? 60,
  mode: defaults?.mode ?? 'quiet',
  lead: defaults?.lead ?? DEFAULT_LEAD,
});
