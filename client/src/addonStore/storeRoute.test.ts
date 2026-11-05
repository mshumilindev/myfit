import { describe, expect, it } from 'vitest';
import { isStoreHash, storeHash, storeTabFromHash } from './storeRoute';

describe('store route', () => {
  it('recognises the store address only', () => {
    expect(isStoreHash('#/store')).toBe(true);
    expect(isStoreHash('#/store/browse')).toBe(true);
    expect(isStoreHash('/store/installed?x=1')).toBe(true);
    expect(isStoreHash('#/storefront')).toBe(false);
    expect(isStoreHash('#/learn')).toBe(false);
    expect(isStoreHash('')).toBe(false);
  });
  it('reads the tab; anything unknown is Discover', () => {
    expect(storeTabFromHash('#/store')).toBe('discover');
    expect(storeTabFromHash('#/store/browse')).toBe('browse');
    expect(storeTabFromHash('#/store/installed?a=b')).toBe('installed');
    expect(storeTabFromHash('#/store/nope')).toBe('discover');
  });
  it('builds addresses that parse back', () => {
    for (const tab of ['discover', 'browse', 'installed'] as const)
      expect(storeTabFromHash(storeHash(tab))).toBe(tab);
    expect(storeHash('discover')).toBe('#/store');
  });
});
