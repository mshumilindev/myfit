import { describe, expect, it } from 'vitest';
import { ADDONS, appOfItem, itemsOfApp, type AddonManifest } from './manifest';

const ids = (l: AddonManifest[]) => l.map((a) => a.id).sort();

// Owner rule 11.11: everything that depends on an app counts as that app's, computed from the registry (never listed by hand).
describe('app members come from `parent` / `requires`', () => {
  it('Gym counts every add-on that requires it, not only Coach extras', () => {
    const gym = itemsOfApp('gym');
    for (const id of ['health', 'sleep', 'activities', 'home-sets', 'goals', 'playbook', 'atlas']) {
      expect(gym.map((a) => a.id)).toContain(id);
    }
    expect(gym.every((a) => a.requires === 'gym' || a.parent === 'gym')).toBe(true);
  });
  it('an app never belongs to another app (Apex requires Gym but stays its own)', () => {
    const apex = ADDONS.find((a) => a.id === 'apex')!;
    expect(appOfItem(apex)).toBeUndefined();
    expect(itemsOfApp('gym').map((a) => a.id)).not.toContain('apex');
    expect(itemsOfApp('apex').every((a) => a.kind === 'module')).toBe(true);
  });
  it('Coach extras still belong to Coach', () => {
    expect(ids(itemsOfApp('coach'))).toEqual([
      'coach-live',
      'coach-notes',
      'coach-signals',
      'coach-team',
    ]);
  });
  it('modules are only those of the opened item (nothing nested from its add-ons)', () => {
    const modules = (id: string) =>
      itemsOfApp(id)
        .filter((a) => a.kind === 'module')
        .map((a) => a.id);
    expect(modules('gym')).toEqual([]);
    expect(modules('health')).toContain('injury-log');
    expect(modules('apex')).toContain('mastery');
  });
  it('themes and coming-soon items are not members', () => {
    const all = ADDONS.filter((a) => appOfItem(a));
    expect(all.some((a) => a.kind === 'theme')).toBe(false);
  });
  it('a new item joins its app by itself (no list to edit)', () => {
    const extra: AddonManifest = {
      id: 'planner',
      kind: 'addon',
      requires: 'gym',
      tone: 1,
      roles: ['member'],
      category: 'workouts',
    };
    const extraMod: AddonManifest = {
      id: 'planner-x',
      kind: 'module',
      parent: 'planner',
      tone: 1,
      roles: ['member'],
      category: 'workouts',
    };
    const list = [...ADDONS, extra, extraMod];
    expect(itemsOfApp('gym', list).map((a) => a.id)).toContain('planner');
    expect(itemsOfApp('planner', list).map((a) => a.id)).toContain('planner-x');
    expect(itemsOfApp('gym').map((a) => a.id)).not.toContain('planner');
  });
});
