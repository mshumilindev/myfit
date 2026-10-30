/**
 * The sleep schedule and the sleep switches that used to live only on the device (SPO-397): one sealed document
 * `users/{uid}/meta/sleepPrefs` (last-write-wins by one stamp, like `exercisePrefs`); the `spotter.sleep.*` keys stay as
 * the cache. Only what the person chose is synced (schedule, auto-dim, auto-log, goal); the per-night bookkeeping
 * (`lastDimDay`, `lastAutoNight`, `skippedAutoSleepDates`, `patternOffer`) stays on the device.
 *
 * Pure (no Firebase, no store import): store.ts owns the listener and the write; this file decides what to keep.
 */
import type { SleepDayPlan, SleepSchedule } from './types';

export interface SleepPrefsSettings {
  autoDim: boolean;
  autoLog: boolean;
  goalMin: number;
}
export interface SleepPrefs {
  schedule: SleepSchedule;
  settings: SleepPrefsSettings;
}

const DEFAULT_GOAL_MIN = 480;
export const EMPTY_SLEEP_PREFS: SleepPrefs = {
  schedule: { sameEveryNight: true, every: null, byDay: {} },
  settings: { autoDim: false, autoLog: false, goalMin: DEFAULT_GOAL_MIN },
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const inDay = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 2880;

function plan(raw: unknown): SleepDayPlan | null {
  if (!isObj(raw) || !inDay(raw.bedMin) || !inDay(raw.wakeMin)) return null;
  return { bedMin: raw.bedMin, wakeMin: raw.wakeMin };
}

/** A stored or received value to a safe shape: anything unknown is dropped, never guessed. */
export function normalizeSleepPrefs(raw: unknown): SleepPrefs {
  const o = isObj(raw) ? raw : {};
  const sch = isObj(o.schedule) ? o.schedule : {};
  const byDay: Partial<Record<number, SleepDayPlan>> = {};
  if (isObj(sch.byDay)) {
    for (const [k, v] of Object.entries(sch.byDay)) {
      const day = Number(k);
      const p = plan(v);
      if (Number.isInteger(day) && day >= 0 && day <= 6 && p) byDay[day] = p;
    }
  }
  const s = isObj(o.settings) ? o.settings : {};
  const goal = s.goalMin;
  return {
    schedule: {
      sameEveryNight: sch.sameEveryNight === false ? false : true,
      every: plan(sch.every),
      byDay,
    },
    settings: {
      autoDim: s.autoDim === true,
      autoLog: s.autoLog === true,
      goalMin:
        typeof goal === 'number' && Number.isFinite(goal) && goal > 0 && goal <= 1440
          ? goal
          : DEFAULT_GOAL_MIN,
    },
  };
}

/** Anything the person has set (so a first sync has something to keep). */
export function hasCustomSleepPrefs(p: SleepPrefs): boolean {
  return canon(p) !== canon(EMPTY_SLEEP_PREFS);
}

export interface SleepPrefsDecision {
  /** Take this from the account. */
  apply?: { at: number; prefs: SleepPrefs };
  /** Write this device's values to the account. */
  push?: boolean;
}

/**
 * A snapshot of the account's document arrived. `remote` is null when the account has none yet.
 * - none yet: keep what this device has (push it, once, if it is not all defaults);
 * - a newer local edit that has not echoed back yet wins over the snapshot;
 * - otherwise the account's values replace this device's (the account wins on a new device).
 */
export function reconcileSleepPrefs(
  local: { at: number; prefs: SleepPrefs },
  remote: { at: number; raw: unknown } | null,
): SleepPrefsDecision {
  if (!remote) return hasCustomSleepPrefs(local.prefs) ? { push: true } : {};
  const theirs = normalizeSleepPrefs(remote.raw);
  if (local.at > remote.at) return canon(theirs) === canon(local.prefs) ? {} : { push: true };
  // First contact (this device never edited or synced these) with values set, while the account holds only defaults or
  // junk: keep the device's values and send them; an empty document must not wipe a schedule nobody ever uploaded.
  if (local.at === 0 && hasCustomSleepPrefs(local.prefs) && !hasCustomSleepPrefs(theirs))
    return { push: true };
  return { apply: { at: remote.at, prefs: theirs } };
}

/** Key-order-independent text of a value, to compare two settings objects. */
function canon(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : x,
  );
}
