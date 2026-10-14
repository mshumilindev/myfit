import { useCallback, useEffect, useState } from 'react';
import {
  coachHash,
  isCoachDashHash,
  parseCoachHash,
  rememberCoachRoute,
  sameRoute,
  type CoachRoute,
} from './routes';

/**
 * The Coach route, a pure function of `location.hash`. Navigating assigns the
 * hash (a history entry, so Back works); Back / refresh / a shared link restore
 * the screen. The last route is remembered for the mode switch round trip.
 */
export function useCoachRoute(): [CoachRoute, (route: CoachRoute) => void] {
  const [route, setRoute] = useState<CoachRoute>(() => parseCoachHash(window.location.hash));

  useEffect(() => {
    const onHash = () => {
      // Another app took the hash (mode switch): keep the last Coach route as is.
      if (!isCoachDashHash(window.location.hash)) return;
      const next = parseCoachHash(window.location.hash);
      setRoute((cur) => (sameRoute(cur, next) ? cur : next));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    rememberCoachRoute(route);
    // A bare `#/c`, a bad path or an old URL (`clients/<id>/program/edit`) is rewritten to the canonical hash in place.
    const path = window.location.hash.split('?')[0];
    if (path !== coachHash(route).split('?')[0] && isCoachDashHash(path)) {
      window.history.replaceState(null, '', coachHash(route));
    }
  }, [route]);

  const navigate = useCallback((next: CoachRoute) => {
    setRoute(next);
    if (window.location.hash !== coachHash(next)) window.location.hash = coachHash(next);
  }, []);

  return [route, navigate];
}
