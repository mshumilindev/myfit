/**
 * Opening hours of the gyms the calendar knows: the fixtures carry them, a real gym is looked up once from its place
 * (the same lookup the gym picker uses: OpenStreetMap, else Google Places when the geo-search consent allows it; the
 * OpenStreetMap answer is cached on the device for two weeks, Google's never leaves memory).
 * Unknown hours are `null`: nothing is shaded and no warning is raised for that gym.
 */
import { useEffect, useMemo, useState } from 'react';
import type { GymWeek, GymWeeks } from './hours';
import { scheduleGyms, type Gym } from './types';
import { isGeoSearchOn, subscribeGeo } from '../../data/geoSearchGate';

const FOUND_TTL_MS = 60 * 60_000;
const found = new Map<string, { at: number; week: GymWeek }>();
const freshWeek = (id: string): GymWeek | undefined => {
  const hit = found.get(id);
  return hit && Date.now() - hit.at < FOUND_TTL_MS ? hit.week : undefined;
};
// Switching gym search off also empties the hours found through it.
subscribeGeo(() => {
  if (!isGeoSearchOn()) found.clear();
});
const inflight = new Set<string>();

export function useGymWeeks(gyms: readonly Gym[] = scheduleGyms()): GymWeeks {
  const [, bump] = useState(0);
  const key = gyms.map((g) => g.id).join('|');
  useEffect(() => {
    let live = true;
    for (const g of gyms) {
      if (g.hours || !g.place || freshWeek(g.id) || inflight.has(g.id)) continue;
      inflight.add(g.id);
      const ctl = new AbortController();
      void import('../../data/gymProviders')
        .then((m) =>
          m.resolveGymMeta(g.place!.lat, g.place!.lng, ctl.signal, g.name).then((meta) => {
            const parsed = meta ? (meta.hours ?? m.parseOpeningHours(meta.openingHours)) : null;
            // Only a real answer is remembered: "nothing yet" (not signed in, offline) is asked again next time.
            if (parsed) found.set(g.id, { at: Date.now(), week: parsed.week });
          }),
        )
        .catch(() => undefined)
        .finally(() => {
          inflight.delete(g.id);
          if (live) bump((n) => n + 1);
        });
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return useMemo(
    () => new Map(gyms.map((g) => [g.id, g.hours ?? freshWeek(g.id) ?? null] as const)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, found.size],
  );
}
