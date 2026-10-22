/** One read of "what does the Cycle say today", shared by every surface (pure; takes the store slices). */
import { dayOfTimestamp } from '../components/ui/calendarDays';
import type { ChronicCondition } from '../types';
import {
  cycleSuppressedBy,
  estimate,
  isStale,
  type CycleEstimate,
  type CycleSuppression,
} from './cycleCore';
import type { CycleState } from './cycleState';

/**
 * Why the Cycle is paused. `hidden` = only a stored safety limit pauses it (the Chronic conditions consent is off): the
 * Cycle stays paused, but no surface may name the condition (SPO-290 owner decision).
 */
export type CyclePause = CycleSuppression | 'hidden';

export type CycleToday =
  | { kind: 'off' }
  | { kind: 'paused'; why: CyclePause }
  | { kind: 'log' }
  | { kind: 'stale' }
  | { kind: 'ok'; est: CycleEstimate };

/**
 * RESTRICTION + DISPLAY split: `shown` are the conditions the app may display (empty while Chronic conditions is off),
 * `stored` the stored safety limits. A pregnancy or menopause pauses the Cycle either way, but only a displayable one
 * is named.
 */
export function cyclePause(
  shown: readonly ChronicCondition[],
  stored: readonly ChronicCondition[],
  now: number,
): CyclePause | null {
  return cycleSuppressedBy(shown, now) ?? (cycleSuppressedBy(stored, now) ? 'hidden' : null);
}

export function cycleToday(
  cycle: CycleState,
  conditions: readonly ChronicCondition[],
  now: number,
  stored: readonly ChronicCondition[] = conditions,
): CycleToday {
  if (!cycle.enabled || !cycle.settings) return { kind: 'off' };
  const why = cyclePause(conditions, stored, now);
  if (why) return { kind: 'paused', why };
  const s = cycle.settings;
  if (s.mode === 'log') return { kind: 'log' };
  const today = dayOfTimestamp(now);
  if (cycle.pendingDate || isStale(s, today)) return { kind: 'stale' };
  const est = estimate(s, today);
  return est ? { kind: 'ok', est } : { kind: 'stale' };
}
