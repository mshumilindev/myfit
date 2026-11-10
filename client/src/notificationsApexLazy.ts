import { useEffect, useState } from 'react';
import type { useStore } from './store';
import type { useT } from './i18n';
import type { Notif } from './notifications';
import type { ActiveChallenge } from './challenges';
import type { ApexNotifModules } from './notificationsApex';

const NONE: Notif[] = [];
type T = ReturnType<typeof useT>['t'];

/**
 * Apex rows of the bell, computed in the lazy `notificationsApex` chunk. Off (Apex not installed) → no rows and the
 * chunk is never fetched; a failed fetch leaves the rows empty (the rest of the feed is unaffected).
 */
export function useApexNotifRows(
  on: boolean,
  store: ReturnType<typeof useStore>,
  now: number,
  t: T,
  challenges: ActiveChallenge[],
  modules: ApexNotifModules,
): Notif[] {
  const [rows, setRows] = useState<Notif[]>([]);
  const { mastery, ranks, awards } = modules;
  useEffect(() => {
    if (!on) return;
    let live = true;
    void import('./notificationsApex')
      .then((m) => {
        if (live)
          setRows(m.computeApexNotifs(store, now, t, challenges, { mastery, ranks, awards }));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, store.workouts, store.bodyMetrics, challenges, now, t, mastery, ranks, awards]);
  return on ? rows : NONE;
}
