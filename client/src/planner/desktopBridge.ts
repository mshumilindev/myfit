/**
 * The Planner's side of the desktop shell bridge (SPO-552 I8). Feature-detected method by method: in a browser, a PWA or an older shell
 * nothing here does anything. The shell gets only ids, moments and modes - never a title or a note.
 */
import { RING_WINDOW_MS, ringKey } from './alertsCore';
import type { PlanDoc } from './types';
import { localParts } from './zoned';

export interface NativeAlarm {
  id: string;
  at: number;
  mode: 'quiet' | 'ring';
}
export interface NativePrefs {
  trayIcon: boolean;
  openAtLogin: boolean;
  autostartHintShown: boolean;
}
export interface PlannerNative {
  scheduleAlarms?: (list: NativeAlarm[]) => Promise<void>;
  cancelAlarms?: (ids: string[]) => Promise<void>;
  onAlarmDue?: (cb: (alarm: NativeAlarm) => void) => () => void;
  showAlarm?: (p: {
    id: string;
    title: string;
    body?: string;
    mode: 'quiet' | 'ring';
  }) => Promise<void>;
  setTray?: (state: { next: { label: string } | null }) => Promise<void>;
  getPrefs?: () => Promise<NativePrefs>;
  setPrefs?: (patch: Partial<NativePrefs>) => Promise<NativePrefs>;
}

export const nativeBridge = (): PlannerNative | null =>
  typeof window === 'undefined'
    ? null
    : ((window as unknown as { spotterNative?: PlannerNative }).spotterNative ?? null);

/** How far ahead the shell is told: the page tells it again on every change, so a week is plenty. */
export const HORIZON_MS = 7 * 24 * 3_600_000;
const MAX = 60;

/**
 * Every moment the shell has to wake for: future moments within the horizon, and the end of each snooze. A dismissed moment
 * (here or on another device) is not in the list, so the shell drops it by itself.
 */
export function planAlarms(
  plans: readonly PlanDoc[],
  now: number,
  handled: ReadonlySet<string>,
  snoozed: Readonly<Record<string, number>>,
): NativeAlarm[] {
  const out: NativeAlarm[] = [];
  for (const plan of plans) {
    if (!plan.enabled) continue;
    for (const at of plan.fireAts ?? (plan.nextFireAt ? [plan.nextFireAt] : [])) {
      if (at + RING_WINDOW_MS <= now || at > now + HORIZON_MS) continue;
      const key = ringKey(plan.id, at);
      if (handled.has(key)) continue;
      const until = snoozed[key];
      if (until !== undefined && until > now) {
        out.push({ id: `${key}#${until}`, at: until, mode: plan.mode });
      } else if (at > now) {
        out.push({ id: key, at, mode: plan.mode });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX);
}

/** The line the tray / menu bar shows: the next plan that has not rung yet, "Title · 18:30". */
export function nextUp(
  plans: readonly PlanDoc[],
  now: number,
  handled: ReadonlySet<string>,
): string | null {
  let best: { at: number; plan: PlanDoc } | null = null;
  for (const plan of plans) {
    if (!plan.enabled) continue;
    for (const at of plan.fireAts ?? (plan.nextFireAt ? [plan.nextFireAt] : [])) {
      if (at <= now || handled.has(ringKey(plan.id, at))) continue;
      if (!best || at < best.at) best = { at, plan };
    }
  }
  if (!best) return null;
  const start = best.at + best.plan.timing.lead * 60_000;
  return `${best.plan.title} · ${localParts(start, best.plan.timing.tz).time}`;
}

/** What to show for an alarm that came due: the plan, found by the id's `planId:moment` part. */
export function planOfAlarm(plans: readonly PlanDoc[], id: string): PlanDoc | undefined {
  const key = id.split('#')[0];
  return plans.find((p) => key.startsWith(`${p.id}:`));
}
