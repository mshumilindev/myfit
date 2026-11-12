/**
 * The trainer's read of one client's availability (SPO-552 I10). Everything about the person's own choice stays on their
 * device: this only asks the server for the sealed view the device published, opens it with the grant, and keeps the
 * `availability` part. Screens import this file only; the real adapter is `firestore/availabilityPort.ts`.
 *
 * States: `shared` (hours and not-available days), `not-shared` (nothing published: the person has not allowed it, or
 * Planner is not installed on their side; the trainer is never told which), `failed` (try again).
 */
import { useCallback, useEffect, useState } from 'react';
import type { ClientAvailability } from '../domain/availability';

export type AvailabilityRead =
  { state: 'shared'; availability: ClientAvailability } | { state: 'not-shared' };

export interface AvailabilityPort {
  read(clientId: string): Promise<AvailabilityRead>;
}

let active: AvailabilityPort | null = null;
/** Install the real adapter; null goes back to "nothing shared" (tests, stories, sign-out). */
export function configureAvailability(p: AvailabilityPort | null): void {
  active = p;
}
export const readClientAvailability = (clientId: string): Promise<AvailabilityRead> =>
  active ? active.read(clientId) : Promise.resolve({ state: 'not-shared' });

export type AvailabilityView =
  { state: 'loading' } | { state: 'failed'; retry: () => void } | AvailabilityRead;

/** One client's availability; reloads when the client changes, `retry` after a failure. */
export function useClientAvailability(clientId: string | null): AvailabilityView {
  const [tick, setTick] = useState(0);
  const [res, setRes] = useState<{ key: string; v: AvailabilityRead | 'failed' } | null>(null);
  const key = `${clientId ?? ''}|${tick}`;
  useEffect(() => {
    if (!clientId) return;
    let live = true;
    readClientAvailability(clientId).then(
      (v) => live && setRes({ key, v }),
      () => live && setRes({ key, v: 'failed' }),
    );
    return () => {
      live = false;
    };
  }, [clientId, key]);
  const retry = useCallback(() => setTick((n) => n + 1), []);
  if (!clientId) return { state: 'not-shared' };
  if (!res || res.key !== key) return { state: 'loading' };
  return res.v === 'failed' ? { state: 'failed', retry } : res.v;
}
