import { useCallback, useEffect, useState } from 'react';
import {
  coachHash,
  isCoachDashHash,
  parseCoachHash,
  rememberCoachRoute,
  sameRoute,
  type CoachRoute,
} from './routes';
import { navigateHash } from '../navigateHash';
import { currentHash, replaceHash } from '../route';

/**
 * The Coach route, a pure function of `location.hash`. Navigating assigns the
 * hash (a history entry, so Back works); Back / refresh / a shared link restore
 * the screen. The last route is remembered for the mode switch round trip.
 */
export function useCoachRoute(): [CoachRoute, (route: CoachRoute) => void] {
  const [route, setRoute] = useState<CoachRoute>(() => parseCoachHash(currentHash()));

  useEffect(() => {
    const onHash = () => {
      // Another app took the hash (mode switch): keep the last Coach route as is.
      if (!isCoachDashHash(currentHash())) return;
      const next = parseCoachHash(currentHash());
      setRoute((cur) => (sameRoute(cur, next) ? cur : next));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    rememberCoachRoute(route);
    // A bare `#/c`, a bad path or an old URL (`clients/<id>/program/edit`) is rewritten to the canonical hash in place.
    const path = currentHash().split('?')[0];
    if (path !== coachHash(route).split('?')[0] && isCoachDashHash(path)) {
      replaceHash(coachHash(route));
    }
  }, [route]);

  const navigate = useCallback((next: CoachRoute) => {
    setRoute(next);
    if (currentHash() !== coachHash(next)) navigateHash(coachHash(next));
  }, []);

  return [route, navigate];
}
