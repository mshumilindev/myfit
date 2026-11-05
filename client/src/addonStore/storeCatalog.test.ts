import { describe, expect, it } from 'vitest';
import { availableForRole, catalogForRole, comingSoonForRole, hasStore } from './storeCatalog';

const ids = (l: { id: string }[]) => l.map((m) => m.id);

describe('role-visible catalog', () => {
  it('gives a manager no store and an empty catalog', () => {
    expect(hasStore('manager')).toBe(false);
    expect(catalogForRole('manager')).toEqual([]);
  });
  it('shows Gyms to a trainer and an admin, never to a member', () => {
    expect(ids(catalogForRole('trainer'))).toContain('gyms');
    expect(ids(catalogForRole('admin'))).toContain('gyms');
    expect(ids(catalogForRole('member'))).not.toContain('gyms');
  });
  it('keeps member-only items away from a trainer', () => {
    expect(ids(catalogForRole('trainer'))).not.toContain('health');
    expect(ids(catalogForRole('member'))).toContain('health');
  });
  it('lists coming-soon items apart from what can be turned on', () => {
    expect(ids(comingSoonForRole('member')).sort()).toEqual(['music', 'nutrition']);
    expect(ids(availableForRole('member'))).not.toContain('nutrition');
    expect(comingSoonForRole('trainer')).toEqual([]);
  });
});
