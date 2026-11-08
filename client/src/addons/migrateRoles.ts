import type { Role } from '../api';
import { addonsPref, enableAddons, moduleIdsOf } from './enabledSet';

/**
 * One time per account (SPO-500, owner 08.11): accounts made before the add-on store keep what they could see.
 * A trainer or admin with stored workouts gets Gym (and Sleep / Health when those have data); a trainer gets the Coach
 * extras, an admin gets Coach and its extras (they could open the coach screens before). New accounts start with the
 * base of their role. The marker is an id in the synced add-on list, so no other device repeats it; clients keep
 * unknown ids, so an old client does not erase it.
 */
export const ROLES_MIGRATED = 'migrated:roles-v1';
declare const __BUILD_ID__: string | undefined;
/**
 * Accounts created before this moment are existing ones: the time this build was made (`__BUILD_ID__` is the build time
 * in base 36), so nothing has to be edited at release. Tests and tools without a build id use the date the store landed.
 * A later build moves the line forward only for accounts that have no marker, and every trainer or admin who opened a
 * build since this one already has it.
 */
export const STORE_RELEASE_AT = ((): number => {
  const id = typeof __BUILD_ID__ === 'string' ? parseInt(__BUILD_ID__, 36) : NaN;
  return Number.isFinite(id) && id > 0 ? id : Date.parse('2026-11-08T00:00:00Z');
})();
export const COACH_EXTRAS = ['coach-live', 'coach-signals', 'coach-notes', 'coach-team'];

export interface StoredUsage {
  workouts: number;
  sleeps: number;
  health: boolean;
}

/** Pure: the add-ons to switch on for this role. */
export function roleMigration(role: Role, usage: StoredUsage): string[] {
  if (role !== 'trainer' && role !== 'admin') return [];
  const add: string[] = role === 'admin' ? ['coach', ...COACH_EXTRAS] : [...COACH_EXTRAS];
  if (usage.workouts > 0) {
    add.push('gym');
    if (usage.sleeps > 0) add.push('sleep');
    if (usage.health) add.push('health', ...moduleIdsOf('health'));
  }
  return add;
}

/** Runs once the account's data has loaded. `createdAt` is the account's creation time (ms), null while unknown. */
export function migrateRoleAddons(role: Role, usage: StoredUsage, createdAt: number | null): void {
  if (role !== 'trainer' && role !== 'admin') return;
  if (createdAt === null) return;
  const list = addonsPref.snapshot().list;
  if (list.includes(ROLES_MIGRATED)) return;
  if (createdAt < STORE_RELEASE_AT) enableAddons(roleMigration(role, usage), role);
  addonsPref.set([...addonsPref.snapshot().list, ROLES_MIGRATED]);
}
