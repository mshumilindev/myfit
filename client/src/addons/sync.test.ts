import { describe, expect, it } from 'vitest';
import { LIST_PREFS, listPrefFromDoc, reconcileListPref } from '../activityPrefs';
import { addonsPref } from './enabledSet';
import { addonsQueuePref } from './queue';

describe('add-on lists join the account sync', () => {
  it('registers the enabled set and the queue once under their meta/prefs names', () => {
    const map = new Map(LIST_PREFS);
    expect(map.get('addons')).toBe(addonsPref);
    expect(map.get('addonsQueue')).toBe(addonsQueuePref);
    expect(LIST_PREFS.filter(([n]) => n === 'addons')).toHaveLength(1);
  });
});

describe('add-on lists round-trip through the prefs doc', () => {
  it('reads the field pair for both names and lets the newer side win', () => {
    const doc = {
      addons: ['learn', 7],
      addonsUpdatedAt: 20,
      addonsQueue: ['apex'],
      addonsQueueUpdatedAt: 5,
    };
    const remote = listPrefFromDoc(doc, 'addons');
    expect(remote).toEqual({ list: ['learn'], updatedAt: 20 });
    expect(reconcileListPref({ list: [], updatedAt: 10 }, remote).apply).toEqual(remote);
    expect(reconcileListPref({ list: ['x'], updatedAt: 30 }, remote)).toEqual({
      apply: null,
      push: true,
    });
    expect(listPrefFromDoc({}, 'addonsQueue')).toBeNull();
  });
});
