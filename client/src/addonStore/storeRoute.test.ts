import { describe, expect, it } from 'vitest';
import { isStoreHash, parseStoreHash, storeHash, storeTabFromHash } from './storeRoute';

describe('store route', () => {
  it('recognises the store address only', () => {
    expect(isStoreHash('#/store')).toBe(true);
    expect(isStoreHash('#/store/apps')).toBe(true);
    expect(isStoreHash('/store/installed?x=1')).toBe(true);
    expect(isStoreHash('#/storefront')).toBe(false);
    expect(isStoreHash('#/learn')).toBe(false);
    expect(isStoreHash('')).toBe(false);
  });
  it('reads the tab; anything unknown is Discover; the old Browse is Apps', () => {
    expect(storeTabFromHash('#/store')).toBe('discover');
    expect(storeTabFromHash('#/store/apps')).toBe('apps');
    expect(storeTabFromHash('#/store/browse')).toBe('apps');
    expect(storeTabFromHash('#/store/addons')).toBe('addons');
    expect(storeTabFromHash('#/store/themes')).toBe('themes');
    expect(storeTabFromHash('#/store/selected')).toBeNull();
    expect(storeTabFromHash('#/store/installed?a=b')).toBe('installed');
    expect(storeTabFromHash('#/store/nope')).toBe('discover');
  });
  it('item and search belong to no tab', () => {
    expect(parseStoreHash('#/store/item/health')).toEqual({ view: 'item', id: 'health' });
    expect(parseStoreHash('#/store/search')).toEqual({ view: 'search' });
    expect(storeTabFromHash('#/store/item/health')).toBeNull();
    expect(storeTabFromHash('#/store/search')).toBeNull();
  });
  it('the install run screens belong to no tab', () => {
    expect(parseStoreHash('#/store/installing')).toEqual({ view: 'installing' });
    expect(parseStoreHash('#/store/done')).toEqual({ view: 'done' });
    expect(storeTabFromHash('#/store/installing')).toBeNull();
    expect(storeTabFromHash('#/store/done')).toBeNull();
  });
  it('manage belongs to no tab and carries the app id', () => {
    expect(parseStoreHash('#/store/manage/health')).toEqual({ view: 'manage', id: 'health' });
    expect(storeTabFromHash('#/store/manage/health')).toBeNull();
    expect(storeHash('manage', 'health')).toBe('#/store/manage/health');
  });
  it('builds addresses that parse back', () => {
    for (const tab of [
      'discover',
      'apps',
      'addons',
      'themes',
      'selected',
      'installed',
      'search',
      'installing',
      'done',
    ] as const)
      expect(parseStoreHash(storeHash(tab))).toEqual({ view: tab });
    expect(parseStoreHash(storeHash('item', 'atlas'))).toEqual({
      view: 'item',
      id: 'atlas',
    });
    expect(storeHash('discover')).toBe('#/store');
  });
});
