import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './enabledSet';
import { COACH_EXTRAS, ROLES_MIGRATED, migrateRoleAddons, roleMigration } from './migrateRoles';

const none = { workouts: 0, sleeps: 0, health: false };
const old = Date.parse('2026-01-01T00:00:00Z');
const fresh = Date.parse('2026-12-01T00:00:00Z');

describe('role migration (owner 08.11)', () => {
  beforeEach(() => addonsPref.reset());
  it('a member is never migrated', () => {
    expect(roleMigration('member', { workouts: 5, sleeps: 5, health: true })).toEqual([]);
    migrateRoleAddons('member', none, old);
    expect(addonsPref.snapshot().list).toEqual([]);
  });
  it('no data: a trainer gets the Coach extras, an admin Coach and its extras, no Gym', () => {
    expect(roleMigration('trainer', none)).toEqual(COACH_EXTRAS);
    expect(roleMigration('admin', none)).toEqual(['coach', ...COACH_EXTRAS]);
  });
  it('stored workouts bring Gym; sleep and health only with their data', () => {
    expect(roleMigration('trainer', { ...none, workouts: 3 })).toContain('gym');
    expect(roleMigration('trainer', { ...none, workouts: 3 })).not.toContain('sleep');
    const all = roleMigration('admin', { workouts: 3, sleeps: 2, health: true });
    expect(all).toEqual(expect.arrayContaining(['gym', 'sleep', 'health']));
    expect(roleMigration('trainer', { ...none, sleeps: 2, health: true })).not.toContain('sleep');
  });
  it('an existing admin is switched on once; a later uninstall sticks', () => {
    migrateRoleAddons('admin', { workouts: 1, sleeps: 0, health: false }, old);
    let list = addonsPref.snapshot().list;
    expect(list).toEqual(expect.arrayContaining(['coach', 'gym', 'coach-live', ROLES_MIGRATED]));
    addonsPref.set(list.filter((i) => i !== 'gym'));
    migrateRoleAddons('admin', { workouts: 1, sleeps: 0, health: false }, old);
    list = addonsPref.snapshot().list;
    expect(list).not.toContain('gym');
  });
  it('a new account starts with the base of its role, only the marker is written', () => {
    migrateRoleAddons('admin', { workouts: 0, sleeps: 0, health: false }, fresh);
    expect(addonsPref.snapshot().list).toEqual([ROLES_MIGRATED]);
  });
  it('waits while the creation time is unknown', () => {
    migrateRoleAddons('admin', none, null);
    expect(addonsPref.snapshot().list).toEqual([]);
  });
});
