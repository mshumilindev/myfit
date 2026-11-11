import type { PlanDoc } from './types';

/** A ring is shown for this long after its moment; later it counts as missed (the quiet push already told the person). */
export const RING_WINDOW_MS = 10 * 60_000;

export interface Ring {
  /** `planId:moment`, the identity of one ring. */
  key: string;
  plan: PlanDoc;
  /** UTC ms of the reminder moment. */
  at: number;
}

export const ringKey = (planId: string, at: number): string => `${planId}:${at}`;

/**
 * The persistent reminders that should be ringing at `now`: ring-mode, enabled, a moment of the plan's open list within the window,
 * and not handled (dismissed) or snoozed past now. `handled` holds dismissed keys, `snoozed` maps a key to when it rings again.
 * Pure, so the layer only has to call it on a timer.
 */
export function dueRings(
  plans: readonly PlanDoc[],
  now: number,
  handled: ReadonlySet<string>,
  snoozed: Readonly<Record<string, number>> = {},
): Ring[] {
  const out: Ring[] = [];
  for (const plan of plans) {
    if (!plan.enabled || plan.mode !== 'ring') continue;
    for (const at of plan.fireAts ?? (plan.nextFireAt ? [plan.nextFireAt] : [])) {
      if (at > now || now - at >= RING_WINDOW_MS) continue;
      const key = ringKey(plan.id, at);
      if (handled.has(key)) continue;
      const until = snoozed[key];
      if (until !== undefined && until > now) continue;
      out.push({ key, plan, at });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** The next moment the layer must look again: a future ring moment, or the end of a snooze, or the window end. */
export function nextWake(
  plans: readonly PlanDoc[],
  now: number,
  snoozed: Readonly<Record<string, number>> = {},
): number | null {
  let best: number | null = null;
  const take = (t: number) => {
    if (t > now && (best === null || t < best)) best = t;
  };
  for (const plan of plans) {
    if (!plan.enabled || plan.mode !== 'ring') continue;
    for (const at of plan.fireAts ?? (plan.nextFireAt ? [plan.nextFireAt] : [])) {
      take(at);
      take(at + RING_WINDOW_MS);
    }
  }
  for (const t of Object.values(snoozed)) take(t);
  return best;
}
