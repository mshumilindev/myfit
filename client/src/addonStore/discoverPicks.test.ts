import { beforeEach, describe, expect, it } from 'vitest';
import {
  appOfTheWeek,
  catalogProgress,
  categoryCount,
  heroMode,
  heroState,
  starterPack,
  suggestion,
} from './discoverPicks';
import { availableForRole, comingSoonForRole } from './storeCatalog';

const none = { role: 'member' as const, enabled: new Set<string>(), queued: [] as string[] };
beforeEach(() => undefined);

describe('discover picks', () => {
  it('App of the week is the best app not installed — and stays when picked', () => {
    expect(appOfTheWeek(none)?.id).toBe('health');
    expect(appOfTheWeek({ ...none, queued: ['health'] })?.id).toBe('health');
    expect(appOfTheWeek({ ...none, enabled: new Set(['health']) })?.id).toBe('atlas');
  });
  it('starter pack: the Recovery pair until fewer than two are left', () => {
    expect(starterPack(none)?.left).toEqual(['health', 'sleep']);
    expect(starterPack({ ...none, enabled: new Set(['health']) })).toBeNull();
    expect(starterPack({ ...none, role: 'manager' })).toBeNull();
  });
  it('suggests an add-on only of an installed app', () => {
    expect(suggestion(none)).toBeNull();
    // Health's and Apex's parts are modules (switches in Configure), so nothing is suggested for them.
    expect(suggestion({ ...none, enabled: new Set(['apex', 'health']) })).toBeNull();
  });
  it('the add-on category count comes from the role catalog', () => {
    expect(categoryCount('member')).toBeGreaterThan(2);
    expect(categoryCount('manager')).toBe(0);
  });
  it('coming soon lists every unavailable item of the role (Nutrition and Music), none for a manager', () => {
    expect(comingSoonForRole('member').map((m) => m.id)).toEqual(['nutrition', 'music']);
    expect(comingSoonForRole('manager')).toEqual([]);
  });
  it('health modules are switches inside Health, never store items or categories', () => {
    const ids = availableForRole('member').map((m) => m.id);
    expect(ids).toContain('health');
    for (const m of [
      'injury-log',
      'cycle',
      'supplements',
      'nicotine',
      'alcohol',
      'conditions',
      'rest',
      'unwell',
    ])
      expect(ids).not.toContain(m);
  });
});

describe('progress hero', () => {
  it('takes over at 70% or 3 left and hands back only at 6 or more left', () => {
    expect(heroMode('bento', { done: 7, total: 10, left: 3 })).toBe('progress');
    expect(heroMode('bento', { done: 8, total: 20, left: 12 })).toBe('bento');
    expect(heroMode('bento', { done: 15, total: 20, left: 5 })).toBe('progress');
    expect(heroMode('progress', { done: 3, total: 10, left: 7 })).toBe('bento');
    expect(heroMode('progress', { done: 6, total: 11, left: 5 })).toBe('progress');
    expect(heroMode('bento', { done: 6, total: 11, left: 5 })).toBe('bento');
    expect(heroMode('bento', { done: 0, total: 0, left: 0 })).toBe('bento');
  });
  it('picks the hero look from what is left', () => {
    expect(heroState(0)).toBe('complete');
    expect(heroState(2)).toBe('almost');
    expect(heroState(5)).toBe('progress');
  });
  it('counts the installed part of the role catalog', () => {
    const p = catalogProgress('member', new Set(['health']));
    expect(p.done).toBe(1);
    expect(p.left).toBe(p.total - 1);
  });
});
