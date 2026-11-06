import { describe, expect, it } from 'vitest';
import { LIST_PREFS } from '../activityPrefs';
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
