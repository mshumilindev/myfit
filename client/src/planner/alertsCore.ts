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

/** The shared state of one ring (`users/{uid}/plannerAlerts/{ringKey}`): no content, so it needs no sealing. */
export interface AlertState {
  state: 'ringing' | 'snoozed' | 'dismissed';
  /** UTC ms the ring comes back (snoozed only). */
  snoozeUntil?: number;
  /** Bumped on every accepted write: a write that read an older one is retried, never applied blindly. */
  rev: number;
}

/**
 * Race rule across devices (SPO-552 spike): `dismissed` is final and beats everything; of two snoozes the later `snoozeUntil`
 * wins; otherwise the newer write (the incoming one) wins. Returns the state to store, or null when the stored one already says it.
 */
export function mergeAlert(
  current: AlertState | undefined,
  incoming: Pick<AlertState, 'state' | 'snoozeUntil'>,
): AlertState | null {
  const rev = (current?.rev ?? 0) + 1;
  if (current?.state === 'dismissed') return null;
  if (incoming.state === 'dismissed') return { state: 'dismissed', rev };
  if (incoming.state === 'snoozed') {
    const until = incoming.snoozeUntil ?? 0;
    if (current?.state === 'snoozed' && (current.snoozeUntil ?? 0) >= until) return null;
    return { state: 'snoozed', snoozeUntil: until, rev };
  }
  if (current?.state === 'ringing') return null;
  return { state: 'ringing', rev };
}

/** What the open ring list should treat as handled / snoozed, from the shared states of all devices. */
export function foldAlerts(states: Readonly<Record<string, AlertState>>): {
  handled: Set<string>;
  snoozed: Record<string, number>;
} {
  const handled = new Set<string>();
  const snoozed: Record<string, number> = {};
  for (const [key, a] of Object.entries(states)) {
    if (a.state === 'dismissed') handled.add(key);
    else if (a.state === 'snoozed' && a.snoozeUntil !== undefined) snoozed[key] = a.snoozeUntil;
  }
  return { handled, snoozed };
}
