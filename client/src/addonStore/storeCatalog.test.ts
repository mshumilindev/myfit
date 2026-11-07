import { describe, expect, it } from 'vitest';
import { availableForRole, catalogForRole, comingSoonForRole, hasStore } from './storeCatalog';

const ids = (l: { id: string }[]) => l.map((m) => m.id);

describe('role-visible catalog', () => {
  it('gives a manager no store and an empty catalog', () => {
    expect(hasStore('manager')).toBe(false);
    expect(catalogForRole('manager')).toEqual([]);
  });
  it('shows Gyms to a trainer and an admin, never to a member', () => {
    for (const r of ['member', 'trainer', 'admin'] as const)
      expect(ids(catalogForRole(r))).not.toContain('gyms');
  });
  it('offers Health to every role as an add-on (owner 07.11)', () => {
    for (const role of ['member', 'trainer', 'admin'] as const)
      expect(ids(catalogForRole(role)), role).toContain('health');
  });
  it('lists coming-soon items apart from what can be turned on', () => {
    expect(ids(comingSoonForRole('member')).sort()).toEqual(['music', 'nutrition']);
    expect(ids(availableForRole('member'))).not.toContain('nutrition');
    expect(comingSoonForRole('trainer')).toEqual([]);
  });
});
