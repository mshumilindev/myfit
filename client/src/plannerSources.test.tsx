import { describe, expect, it } from 'vitest';
import { plannerSources, registerPlannerSource } from './plannerSources';

describe('Planner "Based on" sources', () => {
  it('a registered source is listed by order; re-registering replaces it', () => {
    const Group = () => null;
    registerPlannerSource({ id: 'z-test', order: 99, Group });
    registerPlannerSource({ id: 'a-test', order: 98, Group });
    registerPlannerSource({ id: 'z-test', order: 1, Group });
    const ids = plannerSources().map((s) => s.id);
    expect(ids.indexOf('z-test')).toBeLessThan(ids.indexOf('a-test'));
    expect(ids.filter((i) => i === 'z-test')).toHaveLength(1);
  });

  it('every file in plannerSources/ registers itself (no list to edit)', async () => {
    const mods = import.meta.glob('./plannerSources/*.tsx', { eager: true });
    expect(Object.keys(mods).length).toBeGreaterThanOrEqual(3);
    const ids = plannerSources().map((s) => s.id);
    for (const id of ['program-days', 'home-sets', 'activities']) expect(ids).toContain(id);
  });
});
