/**
 * Keeps the holiday theme in step with the calendar while the app is open (SPO-321). Opening the app is handled
 * by `initTheme`; this covers a tab that stays open across midnight or comes back from the background. It runs on
 * the device only — no server, no function. A switch never interrupts the person: in a quiet zone (a workout, a
 * document, a chat) or while a theme preview is open it waits and is applied as soon as they have left.
 */
import { currentHash } from '../route';
import { holidaySwitchPending, syncHolidayTheme } from './registry';
import { msToNextDay } from './holidays';
import { quietZoneAt } from './quietZones';

/** How often a switch that had to wait looks again (only while one is waiting). */
const RETRY_MS = 3_000;

export function startHolidayWatch(): () => void {
  let midnight: number | undefined;
  let retry: number | undefined;

  const stopRetry = () => {
    if (retry !== undefined) window.clearInterval(retry);
    retry = undefined;
  };

  const check = () => {
    if (!holidaySwitchPending()) return stopRetry();
    // waiting: a quiet zone, or a preview that syncHolidayTheme refuses to cut short
    if (quietZoneAt(currentHash()) === null && syncHolidayTheme()) return stopRetry();
    if (retry === undefined) retry = window.setInterval(check, RETRY_MS);
  };

  const armMidnight = () => {
    window.clearTimeout(midnight);
    midnight = window.setTimeout(() => {
      check();
      armMidnight();
    }, msToNextDay(new Date()));
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      check();
      armMidnight(); // timers in a background tab can fire late: read the clock again
    }
  };

  check();
  armMidnight();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check);
  return () => {
    window.clearTimeout(midnight);
    stopRetry();
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', check);
    window.removeEventListener('pageshow', check);
  };
}
