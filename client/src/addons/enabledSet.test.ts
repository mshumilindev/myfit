import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADDONS } from './manifest';
import {
  addonsPref,
  closeDependencies,
  disableAddons,
  enableAddons,
  isAddonAllowed,
  isAddonEnabled,
  removalSet,
  resolveEnabled,
} from './enabledSet';

beforeEach(() => {
  localStorage.clear();
  addonsPref.reset();
});

describe('isAddonAllowed', () => {
  it('lets each role see only its own items', () => {
    expect(isAddonAllowed('health', 'member')).toBe(true);
    expect(isAddonAllowed('health', 'trainer')).toBe(false);
    expect(isAddonAllowed('gyms', 'member')).toBe(false); // Gyms is base, not an add-on
    expect(isAddonAllowed('gyms', 'trainer')).toBe(false);
  });
  it('offers Sleep and its extras to every role, so it is out of every base (owner, 06.11)', () => {
    for (const role of ['member', 'trainer', 'admin'] as const)
      for (const id of ['sleep']) expect(isAddonAllowed(id, role), `${id} ${role}`).toBe(true);
  });
  it('gives a manager no store and never allows coming-soon or unknown ids', () => {
    for (const a of ADDONS) expect(isAddonAllowed(a.id, 'manager')).toBe(false);
    expect(isAddonAllowed('nutrition', 'member')).toBe(false);
    expect(isAddonAllowed('music', 'member')).toBe(false);
    expect(isAddonAllowed('nope', 'member')).toBe(false);
  });
  it('keeps every add-on parent in the same role set', () => {
    for (const a of ADDONS) {
      const parent = a.parent && ADDONS.find((p) => p.id === a.parent);
      if (parent) for (const r of a.roles) expect(parent.roles).toContain(r);
    }
  });
});

describe('resolveEnabled', () => {
  it('has nothing on when nothing is stored (base only, existing accounts too)', () => {
    expect(resolveEnabled({ list: [], updatedAt: 0 }, 'member').size).toBe(0);
  });
  it('treats an explicit empty list as base only', () => {
    expect(resolveEnabled({ list: [], updatedAt: 5 }, 'member').size).toBe(0);
  });
  it('ignores ids the role may not use', () => {
    expect([...resolveEnabled({ list: ['gyms', 'health'], updatedAt: 5 }, 'member')]).toEqual([
      'health',
    ]);
  });
});

describe('dependencies', () => {
  it('adds the parent app for an add-on', () => {
    expect(closeDependencies(['cycle'], 'member')).toEqual(['health', 'cycle']);
  });
  it('removes add-ons together with their app', () => {
    expect(removalSet('health').sort()).toEqual(
      ['cycle', 'health', 'injury-log', 'nicotine-alcohol', 'supplements'].sort(),
    );
  });
});

describe('enable / disable', () => {
  it('starts with nothing on; the first choice writes an explicit list', () => {
    expect(isAddonEnabled('cycle', 'member')).toBe(false);
    enableAddons(['cycle', 'supplements'], 'member');
    expect(isAddonEnabled('cycle', 'member')).toBe(true);
    disableAddons(['cycle'], 'member');
    expect(isAddonEnabled('cycle', 'member')).toBe(false);
    expect(isAddonEnabled('supplements', 'member')).toBe(true);
    expect(addonsPref.snapshot().updatedAt).toBeGreaterThan(0);
  });
  it('enabling is idempotent and pulls in the parent', () => {
    addonsPref.set([], 1);
    enableAddons(['cycle'], 'member');
    enableAddons(['cycle'], 'member');
    expect(addonsPref.get()).toEqual(['health', 'cycle']);
  });
  it('removing an app removes its add-ons; re-adding restores nothing extra', () => {
    addonsPref.set(['health', 'cycle'], 1);
    disableAddons(['health'], 'member');
    expect(addonsPref.get()).toEqual([]);
  });
});

describe('useAddonOrBase', () => {
  it('is on for a role the store does not offer the item to, off for a member who has not installed it', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { useAddonOrBase, addonsPref } = await import('./enabledSet');
    addonsPref.reset();
    const api = await import('../api');
    const spy = vi.spyOn(api, 'getRole');
    spy.mockReturnValue('member');
    expect(renderHook(() => useAddonOrBase('health')).result.current).toBe(false);
    spy.mockReturnValue('trainer');
    expect(renderHook(() => useAddonOrBase('health')).result.current).toBe(true);
    spy.mockRestore();
  });
});
