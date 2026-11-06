/**
 * Sleep as the calculations see it: the stored nights while the Sleep add-on is installed, none without it (removal
 * keeps the data, so it comes back on re-install). Formulas are untouched — only their input is gated (SPO-518, I7b).
 */
import { useStore } from '../store';
import type { SleepNight } from '../types';
import { getRole } from '../api';
import { isAddonAllowed, isAddonEnabled, useAddonOrBase } from './enabledSet';

const NONE: SleepNight[] = [];

export function useSleepsForCalc(): SleepNight[] {
  const on = useAddonOrBase('sleep');
  const { sleeps } = useStore();
  return on ? sleeps : NONE;
}

/** The same gate for pure code (no hook): true while Sleep is installed or not offered to this role. */
export function sleepAvailable(): boolean {
  return isAddonEnabled('sleep') || !isAddonAllowed('sleep', getRole());
}
