/**
 * The app Spotter opens on and "Back to Spotter" returns to (owner rule 07.11): Gym when the person has it (a member
 * always does; a trainer or an admin once installed), otherwise Coach, otherwise Users (an admin with neither).
 * Pure: one place for the launcher order, the landing and the store's exit.
 */
import type { Role } from '../api';
import { canUseCoach } from '../coach/access';
import { coachEntryHash } from '../coach/routes';
import { addonAvailable } from './enabledSet';

export type DefaultApp = 'gym' | 'coach' | 'roster';

export function defaultApp(role: Role): DefaultApp {
  if (addonAvailable('gym', role)) return 'gym';
  if (canUseCoach(role) && addonAvailable('coach', role)) return 'coach';
  return role === 'admin' ? 'roster' : 'gym';
}

export function defaultAppHash(role: Role): string {
  const app = defaultApp(role);
  return app === 'coach' ? coachEntryHash() : app === 'roster' ? '#/people/users' : '#/today';
}
