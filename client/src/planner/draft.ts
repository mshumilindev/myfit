import { DEFAULT_LEAD, nextFire, type PlanTiming, type Repeat } from './recurrence';
import type { PlanDoc, PlanMode } from './types';
import { weekday, type DayKey } from './zoned';

export type RepeatKind = 'none' | 'daily' | 'weekly' | 'weekdays' | 'biweekly' | 'monthly';

/** What the form edits. Turned into a PlanDoc by `draftToPlan`. */
export interface Draft {
  id: string;
  title: string;
  color: string;
  icon: string;
  start: DayKey;
  hour: number;
  minute: number;
  repeat: RepeatKind;
  mode: PlanMode;
  lead: number;
}

export const REPEAT_KINDS: RepeatKind[] = [
  'none',
  'daily',
  'weekly',
  'weekdays',
  'biweekly',
  'monthly',
];

export const COLOURS = ['accent', 'ok', 'warmup', 'danger', 'sleep', 'neutral'] as const;

export function repeatOf(kind: RepeatKind, start: DayKey): Repeat {
  switch (kind) {
    case 'none':
      return { kind: 'none' };
    case 'daily':
      return { kind: 'daily', every: 1 };
    case 'weekly':
      return { kind: 'weekly', every: 1, days: [weekday(start)] };
    case 'weekdays':
      return { kind: 'weekly', every: 1, days: [0, 1, 2, 3, 4] };
    case 'biweekly':
      return { kind: 'weekly', every: 2, days: [weekday(start)] };
    case 'monthly':
      return { kind: 'monthly', every: 1 };
  }
}

/** The form kind of a stored repeat (anything else the form cannot make shows as the closest, "weekly"). */
export function kindOf(r: Repeat): RepeatKind {
  if (r.kind === 'none') return 'none';
  if (r.kind === 'daily') return 'daily';
  if (r.kind === 'monthly') return 'monthly';
  if (r.every === 2) return 'biweekly';
  return r.days.length === 5 && r.days.every((d) => d < 5) ? 'weekdays' : 'weekly';
}

const hm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

export function draftToPlan(d: Draft, tz: string, prev: PlanDoc | undefined, now: number): PlanDoc {
  const timing: PlanTiming = {
    tz,
    start: d.start,
    time: hm(d.hour, d.minute),
    lead: d.lead,
    repeat: repeatOf(d.repeat, d.start),
    ends: prev?.timing.ends ?? { kind: 'never' },
    skip: prev?.timing.skip ?? [],
  };
  return {
    ...(prev ?? {}),
    id: d.id,
    title: d.title.trim(),
    icon: d.icon,
    color: d.color,
    timing,
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
  return {
    id: p.id,
    title: p.title,
    color: p.color,
    icon: p.icon,
    start: p.timing.start,
    hour: h ?? 9,
    minute: m ?? 0,
    repeat: kindOf(p.timing.repeat),
    mode: p.mode,
    lead: p.timing.lead,
  };
}

export const newDraft = (id: string, day: DayKey): Draft => ({
  id,
  title: '',
  color: 'accent',
  icon: 'calendar-dots',
  start: day,
  hour: 9,
  minute: 0,
  repeat: 'none',
  mode: 'quiet',
  lead: DEFAULT_LEAD,
});
