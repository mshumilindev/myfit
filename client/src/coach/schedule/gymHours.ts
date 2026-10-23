/**
 * Opening hours of the gyms the calendar knows: the fixtures carry them, a real gym is looked up once from its place
 * (the same lookup the gym picker uses: Google Places, else OpenStreetMap, cached on the device for two weeks).
 * Unknown hours are `null`: nothing is shaded and no warning is raised for that gym.
 */
import { useEffect, useMemo, useState } from 'react';
import type { GymWeek, GymWeeks } from './hours';
import { scheduleGyms, type Gym } from './types';

const found = new Map<string, GymWeek | null>();
const inflight = new Set<string>();

export function useGymWeeks(gyms: readonly Gym[] = scheduleGyms()): GymWeeks {
  const [, bump] = useState(0);
  const key = gyms.map((g) => g.id).join('|');
  useEffect(() => {
    let live = true;
    for (const g of gyms) {
      if (g.hours || !g.place || found.has(g.id) || inflight.has(g.id)) continue;
      inflight.add(g.id);
      const ctl = new AbortController();
      void import('../../data/gymProviders')
        .then((m) =>
          m.resolveGymMeta(g.place!.lat, g.place!.lng, ctl.signal).then((meta) => {
            const parsed = meta ? (meta.hours ?? m.parseOpeningHours(meta.openingHours)) : null;
            found.set(g.id, parsed ? parsed.week : null);
          }),
        )
        .catch(() => found.set(g.id, null))
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
    () => new Map(gyms.map((g) => [g.id, g.hours ?? found.get(g.id) ?? null] as const)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, found.size],
  );
}
