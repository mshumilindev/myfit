import { setQuietFallback } from './quietHours';
import type { SleepNight, SleepSchedule } from './types';

type Plan = { bedMin: number; wakeMin: number };

/**
 * The quiet-hours window the Sleep add-on implies: from the planned bedtime to the planned wake time. `null` while Sleep is not
 * installed or has no rhythm yet. `every` is the plan for all nights, otherwise the learned usual night (`usual`, null when none).
 */
export function sleepQuietWindow(
  installed: boolean,
  schedule: SleepSchedule | null | undefined,
  usual: () => Plan | null,
): { from: number; to: number } | null {
  if (!installed) return null;
  let plan: Plan | null = schedule?.every ?? null;
  if (!plan) {
    try {
      plan = usual();
    } catch {
      plan = null;
    }
  }
  if (!plan || plan.bedMin === plan.wakeMin) return null;
  return { from: plan.bedMin, to: plan.wakeMin };
}

/** Feeds the Sleep window into the app-wide quiet hours (they stay as the person set them once set by hand). */
export function applySleepQuiet(
  installed: boolean,
  schedule: SleepSchedule | null | undefined,
  nights: SleepNight[] | null | undefined,
  usualPlan: (n: SleepNight[] | null | undefined) => Plan | null,
): void {
  setQuietFallback(sleepQuietWindow(installed, schedule, () => usualPlan(nights)));
}
