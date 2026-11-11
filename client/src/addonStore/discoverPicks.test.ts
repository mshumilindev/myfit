import { beforeEach, describe, expect, it } from 'vitest';
import {
  appOfTheWeek,
  catalogProgress,
  categoryCount,
  heroMode,
  heroState,
  holidayOn,
  weekIndex,
  weekPick,
  weekPool,
  starterPack,
  suggestion,
} from './discoverPicks';
import { availableForRole, comingSoonForRole } from './storeCatalog';

const none = { role: 'member' as const, enabled: new Set<string>(), queued: [] as string[] };
beforeEach(() => undefined);

describe('of the week slots (SPO-556)', () => {
  const WEEK = 7 * 86_400_000;
  const t0 = Date.UTC(2026, 10, 11);
  const empty = new Set<string>();
  it('the week turns over on Sunday 00:00 UTC', () => {
    const sun = Date.UTC(2026, 10, 15);
    expect(weekIndex(sun)).toBe(weekIndex(sun - 1) + 1);
    expect(weekIndex(sun + 6 * 86_400_000)).toBe(weekIndex(sun));
  });
  it('each slot draws only its own kind, in catalog order', () => {
    for (const [kind, k] of [
      ['app', 'app'],
      ['addon', 'addon'],
      ['theme', 'theme'],
    ] as const) {
      const pool = weekPool(kind, 'member');
      expect(pool.length).toBeGreaterThan(0);
      expect(pool.every((m) => m.kind === k && !m.soon)).toBe(true);
      expect(weekPick(kind, 'member', empty, t0)?.kind).toBe(k);
    }
  });
  it('installing the pick moves to the next one; everything installed leaves the slot empty', () => {
    const first = weekPick('addon', 'member', empty, t0)!;
    const next = weekPick('addon', 'member', new Set([first.id]), t0)!;
    expect(next.id).not.toBe(first.id);
    const all = new Set(weekPool('theme', 'member').map((m) => m.id));
    expect(weekPick('theme', 'member', all, t0)).toBeNull();
  });
  it('a different week gives a different pick while the pool has more than one item', () => {
    const ids = new Set(
      Array.from({ length: 5 }, (_, i) => weekPick('addon', 'member', empty, t0 + i * WEEK)?.id),
    );
    expect(ids.size).toBeGreaterThan(1);
  });
  it('inside the holiday window an uninstalled Holiday pack is the Theme of the week', () => {
    expect(holidayOn(Date.UTC(2026, 11, 20, 12))).toBe(true);
    expect(holidayOn(Date.UTC(2026, 5, 10, 12))).toBe(false);
    expect(weekPick('theme', 'member', empty, new Date(2026, 11, 20, 12).getTime())?.id).toBe(
      'holiday-themes',
    );
    const installed = new Set(['holiday-themes']);
    expect(
      weekPick('theme', 'member', installed, new Date(2026, 11, 20, 12).getTime())?.id,
    ).not.toBe('holiday-themes');
  });
});

describe('discover picks', () => {
  it('the item of the week rotates every week (an app or an add-on), stays within a week, skips an installed item', () => {
    const WEEK = 7 * 86_400_000;
    const t0 = Date.UTC(2026, 10, 2);
    const first = appOfTheWeek(none, t0);
    expect(first).not.toBeNull();
    expect(appOfTheWeek(none, t0 + 86_400_000)?.id).toBe(first?.id);
    const ids = new Set(Array.from({ length: 6 }, (_, i) => appOfTheWeek(none, t0 + i * WEEK)?.id));
    expect(ids.size).toBeGreaterThan(1);
    // Picking keeps it; installing moves on to another item.
    expect(appOfTheWeek({ ...none, queued: [first!.id] }, t0)?.id).toBe(first?.id);
    const next = appOfTheWeek({ ...none, enabled: new Set([first!.id]) }, t0);
    expect(next?.id).not.toBe(first?.id);
    // Only top-level apps or add-ons: never a module, a theme or a coming-soon item.
    for (let i = 0; i < 8; i++) {
      const m = appOfTheWeek(none, t0 + i * WEEK)!;
      expect(['app', 'addon']).toContain(m.kind);
      expect(m.soon).toBeFalsy();
    }
  });
  it('starter pack: the Recovery pair until fewer than two are left', () => {
    expect(starterPack(none)?.left).toEqual(['health', 'sleep']);
    expect(starterPack({ ...none, enabled: new Set(['health']) })).toBeNull();
    expect(starterPack({ ...none, role: 'manager' })).toBeNull();
  });
  it('starter pack for a trainer is the coach set with Gym, not Recovery', () => {
    const p = starterPack({ ...none, role: 'trainer' });
    expect(p?.id).toBe('coach');
    expect(p?.ids).toContain('gym');
    expect(p?.ids).not.toContain('sleep');
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
