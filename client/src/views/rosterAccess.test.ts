import { describe, expect, it } from 'vitest';
import {
  canUsePeople,
  guardRosterTab,
  isLegacyPeopleClients,
  rosterHomeTab,
  rosterMode,
} from './rosterAccess';

describe('People access (SPO-141): Users is admin-only, Me is for everyone', () => {
  it('only an admin may use the People (Users) app', () => {
    expect(canUsePeople('admin')).toBe(true);
    for (const r of ['member', 'trainer', '', null, undefined, 'root'])
      expect(canUsePeople(r), String(r)).toBe(false);
  });

  it('a non-admin asking for `users` is sent to Me; Me and the feed pass through', () => {
    for (const r of ['member', 'trainer', null, undefined]) {
      expect(guardRosterTab('users', r)).toBe('me');
      expect(guardRosterTab('me', r)).toBe('me');
      expect(guardRosterTab('feed', r)).toBe('feed');
    }
    expect(guardRosterTab('users', 'admin')).toBe('users');
    expect(guardRosterTab('me', 'admin')).toBe('me');
  });

  it('home tab: Users for an admin, Me for everyone else', () => {
    expect(rosterHomeTab('admin')).toBe('users');
    expect(rosterHomeTab('trainer')).toBe('me');
    expect(rosterHomeTab('member')).toBe('me');
  });

  it('Users and Me are separate modes; the feed follows the role home', () => {
    expect(rosterMode('users', 'admin')).toBe('users');
    expect(rosterMode('me', 'admin')).toBe('me');
    expect(rosterMode('feed', 'admin')).toBe('users');
    expect(rosterMode('feed', 'trainer')).toBe('me');
    expect(rosterMode('users', 'member')).toBe('me');
  });

  it('recognises the retired /people/clients address, and only it', () => {
    for (const h of [
      '#/people/clients',
      '/people/clients',
      'people/clients/x',
      '#/people/clients?q=1',
    ])
      expect(isLegacyPeopleClients(h), h).toBe(true);
    for (const h of ['#/people/users', '#/people/me', '#/people/clientsx', '#/c/clients', ''])
      expect(isLegacyPeopleClients(h), h).toBe(false);
  });
});
